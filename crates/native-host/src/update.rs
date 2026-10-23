//! In-app update glue (Android). Decisions and the verified download live in `delta-native-update`; this file
//! only connects them to the Kotlin platform and keeps progress state. The WebView passes no paths or URLs.
use delta_native_update as upd;
use serde_json::{json, Value};
use std::{path::PathBuf, sync::{Mutex, OnceLock}};

#[derive(Clone, Default)]
struct State {
    state: &'static str, // "" = idle
    received: u64,
    total: u64,
    version: String,
    error: String,
    sum: [u8; 32],
}

fn state() -> &'static Mutex<State> {
    static S: OnceLock<Mutex<State>> = OnceLock::new();
    S.get_or_init(|| Mutex::new(State::default()))
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
            if found.is_none() && state().lock().map_err(|_| "update_busy")?.state != "downloading" {
                // nothing newer: drop a stale cached APK (for example after the update was installed)
                let _ = std::fs::remove_dir_all(dir(&env)?);
                *state().lock().map_err(|_| "update_busy")? = State::default();
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
            {
                let mut s = state().lock().map_err(|_| "update_busy")?;
                if s.state == "downloading" {
                    return Err("update_busy".into());
                }
                *s = State { state: "downloading", total: found.size, version: version.clone(), ..State::default() };
            }
            let target = dir(&env)?;
            let _ = std::fs::remove_dir_all(&target);
            tokio::spawn(async move {
                let result = async {
                    let client = upd::net::client()?;
                    upd::net::download_release(&client, &found.version, &found.asset, found.size, &target, |n| {
                        if let Ok(mut s) = state().lock() {
                            s.received = n;
                        }
                    })
                    .await
                }
                .await;
                if let Ok(mut s) = state().lock() {
                    match result {
                        Ok((_, sum)) => {
                            s.sum = sum;
                            s.state = "ready";
                        }
                        Err(e) => {
                            s.state = "failed";
                            s.error = e;
                        }
                    }
                }
            });
            Ok(json!({"started": true}))
        }
        "host.update_status" => {
            let s = state().lock().map_err(|_| "update_busy")?.clone();
            Ok(json!({"state": if s.state.is_empty() { "idle" } else { s.state }, "received": s.received, "total": s.total, "version": s.version, "error": s.error}))
        }
        "host.update_install" => {
            let version = a["version"].as_str().ok_or("invalid_version")?;
            let s = state().lock().map_err(|_| "update_busy")?.clone();
            if s.state != "ready" || s.version != version {
                return Err("update_not_ready".into());
            }
            let env = env()?;
            let apk = dir(&env)?.join("delta.apk");
            // the cache is app-private, but verify once more that the file is still the one that was checked
            if file_sum(&apk)? != s.sum {
                return Err("checksum_mismatch".into());
            }
            // Kotlin reports failures as {"error": code}: a thrown exception would reach us only as a generic failure
            let out = crate::android::platform("update_install", &json!({"path": apk.to_string_lossy(), "version": version}))?;
            if let Some(code) = out["error"].as_str() {
                return Err(code.to_string());
            }
            Ok(json!({"prompted": true}))
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
