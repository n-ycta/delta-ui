//! In-app update glue (Android). Decisions and the verified download live in `delta-native-update`; this file
//! only connects them to the Kotlin platform and keeps progress state. The WebView passes no paths or URLs.
use delta_native_update as upd;
use serde_json::{json, Value};
use std::{path::PathBuf, sync::{Mutex, MutexGuard, OnceLock}, time::Instant};

fn state() -> &'static Mutex<upd::UpdateState> {
    static S: OnceLock<Mutex<upd::UpdateState>> = OnceLock::new();
    S.get_or_init(|| Mutex::new(upd::UpdateState::default()))
}

/// A task that panicked while holding the lock must not disable updates for the rest of the process.
fn lock() -> MutexGuard<'static, upd::UpdateState> {
    state().lock().unwrap_or_else(|e| e.into_inner())
}

fn env() -> Result<Value, String> {
    crate::android::platform("update_env", &json!({}))
}

fn dir(env: &Value) -> Result<PathBuf, String> {
    Ok(PathBuf::from(env["cacheDir"].as_str().ok_or("update_env_invalid")?).join("updates"))
}

fn channel(a: &Value) -> Result<upd::Channel, String> {
    upd::Channel::parse(a["channel"].as_str().unwrap_or("stable")).ok_or_else(|| "invalid_channel".to_string())
}

async fn offer(env: &Value, ch: upd::Channel) -> Result<Option<upd::Offer>, String> {
    let current = env["versionName"].as_str().ok_or("update_env_invalid")?.to_string();
    let abis: Vec<String> = env["abis"].as_array().map(|v| v.iter().filter_map(|s| s.as_str().map(String::from)).collect()).unwrap_or_default();
    let abis: Vec<&str> = abis.iter().map(String::as_str).collect();
    upd::net::fetch_offer(&upd::net::client()?, ch, &current, &abis).await
}

pub async fn call(method: &str, a: &Value) -> Result<Value, String> {
    match method {
        "host.update_check" => {
            let env = env()?;
            let found = offer(&env, channel(a)?).await?;
            if found.is_none() {
                // nothing newer: drop a stale cached APK (for example after the update was installed), but never
                // under an active download or install; the check and the clean-up share one lock
                let mut s = lock();
                if s.check_cleanup_allowed(Instant::now()) {
                    let _ = std::fs::remove_dir_all(dir(&env)?);
                    s.reset();
                }
            }
            Ok(json!({
                "current": env["versionName"], "latest": found.as_ref().map(|o| o.version.clone()),
                "available": found.is_some(), "size": found.as_ref().map(|o| o.size).unwrap_or(0),
                "metered": env["metered"].as_bool().unwrap_or(false),
            }))
        }
        "host.update_download" => {
            let version = a["version"].as_str().ok_or("invalid_version")?.to_string();
            if !upd::valid_version(&version) {
                return Err("invalid_version".into());
            }
            let env = env()?;
            if !upd::newer(env["versionName"].as_str().ok_or("update_env_invalid")?, &version) {
                return Err("not_newer".into());
            }
            if env["metered"].as_bool().unwrap_or(false) && a["allowMetered"] != true {
                return Err("metered_consent_required".into());
            }
            // the version must be a real, newer release on the chosen channel; this also yields asset and size
            let found = offer(&env, channel(a)?).await?.filter(|o| o.version == version).ok_or("version_not_offered")?;
            let generation = lock().begin_download(&version, found.size, Instant::now())?;
            let target = dir(&env)?;
            let _ = std::fs::remove_dir_all(&target);
            let task = tokio::spawn(async move {
                let result = async {
                    let client = upd::net::client()?;
                    upd::net::download_release(&client, &found.version, &found.asset, found.size, &target, |n| {
                        lock().progress(generation, n);
                    })
                    .await
                    .map(|(_, sum)| sum)
                }
                .await;
                lock().finish(generation, result);
            });
            // a panic in the task would leave "downloading" forever: the watcher turns it into a failure
            tokio::spawn(async move {
                if task.await.is_err() {
                    lock().finish(generation, Err("update_failed".into()));
                }
            });
            Ok(json!({"started": true}))
        }
        "host.update_status" => {
            let mut s = lock();
            let phase = s.status(Instant::now());
            Ok(json!({"state": phase.as_str(), "received": s.received, "total": s.total, "version": s.version, "error": s.error}))
        }
        "host.update_install" => {
            let version = a["version"].as_str().ok_or("invalid_version")?.to_string();
            let sum = lock().begin_install(&version, Instant::now())?;
            // hashing 100+ MB and the Kotlin call block: keep them off the async workers
            let result = tokio::task::spawn_blocking(move || {
                let apk = dir(&env()?)?.join("delta.apk");
                // the cache is app-private, but verify once more that the file is still the one that was checked
                if file_sum(&apk)? != sum {
                    return Err("checksum_mismatch".to_string());
                }
                // Kotlin gets the expected digest from our state, never from the WebView, and reports failures
                // as {"error": code}: a thrown exception would reach us only as a generic failure
                let out = crate::android::platform("update_install", &json!({"path": apk.to_string_lossy(), "version": version, "sha256": upd::hex(&sum)}))?;
                match out["error"].as_str() {
                    Some(code) => Err(code.to_string()),
                    None => Ok(json!({"prompted": true})),
                }
            })
            .await
            .unwrap_or_else(|_| Err("update_failed".to_string()));
            lock().end_install(result.is_ok());
            result
        }
        _ => Err("unsupported".into()),
    }
}

fn file_sum(path: &std::path::Path) -> Result<[u8; 32], String> {
    use std::io::Read;
    let mut f = std::fs::File::open(path).map_err(|_| "update_not_ready".to_string())?;
    let mut buf = [0u8; 64 * 1024];
    let mut hasher = upd::Hasher::new();
    loop {
        let n = f.read(&mut buf).map_err(|_| "storage_failed".to_string())?;
        if n == 0 {
            return Ok(hasher.finish());
        }
        hasher.update(&buf[..n]);
    }
}
