//! Catalog-only static app installation and isolated per-app URI handlers.
use serde_json::{json, Value};
use std::{path::PathBuf, sync::Mutex};
use tauri::Manager;
pub struct AppStore(pub Mutex<()>);
pub fn catalog() -> Vec<Value> {
    serde_json::from_str(include_str!("../../../app-catalog.json")).expect("reviewed app catalog")
}
fn root(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|p| p.join("apps"))
        .map_err(|_| "app_storage_unavailable".into())
}
pub async fn call(app: &tauri::AppHandle, method: &str, a: &Value) -> Result<Value, String> {
    let root = root(app)?;
    if method == "host.apps_catalog" {
        return Ok(json!(catalog()));
    }
    if method == "host.apps_list" {
        return Ok(json!(delta_app_runtime::list(&root)));
    }
    let id = a["id"].as_str().ok_or("invalid_app")?;
    let item = catalog()
        .into_iter()
        .find(|m| m["id"] == id)
        .ok_or("unknown_app")?;
    match method {
        "host.apps_install" => {
            let replace = a["replace"].as_bool().unwrap_or(false);
            if !replace && delta_app_runtime::list(&root).iter().any(|v| v["id"] == id) {
                return Err("already_installed".into());
            }
            let url = item["asset"].as_str().ok_or("invalid_catalog")?;
            if !url.starts_with("https://github.com/n-ycta/")
                || !url.contains("/releases/download/")
            {
                return Err("untrusted_release".into());
            }
            #[cfg(target_os = "android")]
            let bundled = app
                .path()
                .app_data_dir()
                .map_err(|_| "app_storage_unavailable")?
                .join("bundled-apps")
                .join(format!("{id}.delta-app"));
            #[cfg(not(target_os = "android"))]
            let bundled = app
                .path()
                .resource_dir()
                .map_err(|_| "app_storage_unavailable")?
                .join("app-packages")
                .join(format!("{id}.delta-app"));
            let bytes = if bundled.is_file() {
                let size = std::fs::metadata(&bundled)
                    .map_err(|_| "package_read_failed")?
                    .len();
                if size > delta_app_runtime::MAX_PACKAGE as u64 {
                    return Err("package_limit".into());
                }
                std::fs::read(bundled).map_err(|_| "package_read_failed")?
            } else {
                let client = reqwest::Client::builder()
                    .https_only(true)
                    .timeout(std::time::Duration::from_secs(120))
                    .user_agent("Delta-App/1")
                    .build()
                    .map_err(|_| "download_failed")?;
                let mut response = client
                    .get(url)
                    .send()
                    .await
                    .map_err(|_| "download_failed")?
                    .error_for_status()
                    .map_err(|_| "download_failed")?;
                let mut bytes = vec![];
                while let Some(b) = response.chunk().await.map_err(|_| "download_failed")? {
                    if bytes.len() + b.len() > delta_app_runtime::MAX_PACKAGE {
                        return Err("package_limit".into());
                    }
                    bytes.extend_from_slice(&b)
                }
                bytes
            };
            let state = app.state::<AppStore>();
            let _guard = state.0.lock().map_err(|_| "app_store_busy")?;
            delta_app_runtime::install_with_options(&root, &bytes, &item, replace)
                .map_err(|e| e.to_string())
        }
        "host.apps_remove" => {
            let state = app.state::<AppStore>();
            let _guard = state.0.lock().map_err(|_| "app_store_busy")?;
            let path = root.join(id);
            if path.exists() {
                std::fs::remove_dir_all(path).map_err(|_| "remove_failed")?
            }
            Ok(json!({"removed":true}))
        }
        "host.apps_launch" => {
            if !delta_app_runtime::list(&root).iter().any(|m| m["id"] == id) {
                return Err("not_installed".into());
            }
            let protocol = delta_app_runtime::protocol(id);
            #[cfg(target_os = "windows")]
            let url = format!("http://{protocol}.localhost/index.html");
            #[cfg(not(target_os = "windows"))]
            let url = format!("{protocol}://localhost/index.html");
            Ok(json!({"url":url,"id":id,"name":item["name"],"grants":[]}))
        }
        _ => Err("unsupported_app_operation".into()),
    }
}
pub fn register(mut builder: tauri::Builder<tauri::Wry>) -> tauri::Builder<tauri::Wry> {
    for item in catalog() {
        let id = item["id"].as_str().unwrap().to_owned();
        let protocol = delta_app_runtime::protocol(&id);
        builder = builder.register_uri_scheme_protocol(protocol, move |ctx, request| {
            let result = (|| {
                if request.method() != "GET" && request.method() != "HEAD" {
                    return Err("method");
                }
                let root = root(ctx.app_handle()).map_err(|_| "storage")?;
                let path = request.uri().path().trim_start_matches('/');
                let path = if path.is_empty() { "index.html" } else { path };
                let file = delta_app_runtime::asset(&root, &id, path).map_err(|_| "not_found")?;
                let bytes = if request.method() == "HEAD" {
                    vec![]
                } else {
                    std::fs::read(file).map_err(|_| "not_found")?
                };
                Ok((delta_app_runtime::mime(path), bytes))
            })();
            match result {
                Ok((mime, bytes)) => tauri::http::Response::builder()
                    .header("Content-Type", mime)
                    .header("Content-Security-Policy", delta_app_runtime::CSP)
                    .header("X-Content-Type-Options", "nosniff")
                    .header("Referrer-Policy", "no-referrer")
                    .header("Cache-Control", "no-cache")
                    .body(bytes)
                    .unwrap(),
                Err(_) => tauri::http::Response::builder()
                    .status(404)
                    .body(b"App unavailable".to_vec())
                    .unwrap(),
            }
        });
    }
    builder
}
