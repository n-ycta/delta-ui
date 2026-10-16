//! Credential-private root-document adapter shared by Desktop and Android.
mod apps;
use std::sync::{Arc,Mutex};use delta_host_runtime::HostRuntime;use serde_json::{json,Value};use tauri::{Manager,State,WebviewWindow};
#[cfg(target_os="android")]pub mod android;
struct HostState{#[cfg(not(target_os="android"))]runtime:Arc<HostRuntime>,pending:Mutex<Option<String>>}
fn trusted(window:&WebviewWindow)->Result<(),Value>{let url=window.url().map_err(|_|json!({"code":"forbidden"}))?;if window.label()!="main"||!((url.scheme()=="tauri"&&url.host_str()==Some("localhost"))||(["http","https"].contains(&url.scheme())&&url.host_str()==Some("tauri.localhost"))){return Err(json!({"code":"forbidden"}))}Ok(())}
fn runtime(state:&HostState)->Result<Arc<HostRuntime>,Value>{#[cfg(target_os="android")] {let _=state;android::active().map_err(|code|json!({"code":code}))}#[cfg(not(target_os="android"))]{Ok(state.runtime.clone())}}
#[tauri::command]async fn host_info(window:WebviewWindow,state:State<'_,HostState>)->Result<Value,Value>{trusted(&window)?;let mut v=runtime(&state)?.info(env!("CARGO_PKG_VERSION"),"0.1.3");let f=v["features"].as_array_mut().unwrap();f.extend([json!("native-export"),json!("native-share"),json!("external-links")]);#[cfg(target_os="android")]{f.push(json!("android-keystore"));f.push(json!("background-service"));if android::platform("info",&json!({})).ok().is_some_and(|s|s["backgroundRunning"]==true){v["lifecycle"]=json!("foreground-service")}}#[cfg(not(target_os="android"))]{f.push(json!("autostart"));}Ok(v)}
#[tauri::command]async fn host_call(app:tauri::AppHandle,window:WebviewWindow,state:State<'_,HostState>,request:Value)->Result<Value,Value>{trusted(&window)?;let r=delta_host_runtime::Request::parse(request.clone()).map_err(|e|e.to_value())?;
 if r.capability.starts_with("host.apps_"){if r.node.is_some(){return Err(json!({"code":"forbidden"}))}return apps::call(&app,&r.capability,&r.args).await.map_err(|code|json!({"code":code}));}
 if r.capability=="host.platform_status"||r.capability=="host.background"||r.capability=="host.export"||r.capability=="host.share"||r.capability=="host.open"||r.capability=="host.autostart"||r.capability=="host.notify" {
  let method=r.capability.trim_start_matches("host.");
  #[cfg(target_os="android")] {let _=&app;return android::platform(if method=="platform_status"{"status"}else{method},&r.args).map_err(|code|json!({"code":code}))}
  #[cfg(not(target_os="android"))] return desktop_platform(&app,&state,method,r.args).map_err(|code|json!({"code":code}));
 }
 runtime(&state)?.call(request).await.map_err(|e|e.to_value())
}
#[cfg(not(target_os="android"))]
fn desktop_platform(app:&tauri::AppHandle,state:&HostState,method:&str,a:Value)->Result<Value,String>{
 use tauri_plugin_autostart::ManagerExt;use tauri_plugin_dialog::DialogExt;use tauri_plugin_opener::OpenerExt;
 match method{
 "platform_status"=>Ok(json!({"autostart":app.autolaunch().is_enabled().unwrap_or(false),"backgroundRunning":true,"pendingPairing":state.pending.lock().unwrap().take(),"kind":"desktop"})),
 "autostart"=>{if a["enabled"]==true{app.autolaunch().enable()}else{app.autolaunch().disable()}.map_err(|_|"autostart_failed")?;Ok(json!({"enabled":app.autolaunch().is_enabled().map_err(|_|"autostart_failed")?}))},
 "open"=>{let url=a["url"].as_str().ok_or("invalid_url")?;let u=tauri::Url::parse(url).map_err(|_|"invalid_url")?;if !["http","https"].contains(&u.scheme())||!u.username().is_empty()||u.password().is_some(){return Err("invalid_url".into())}app.opener().open_url(url,None::<&str>).map_err(|_|"open_failed")?;Ok(json!({"opened":true}))},
 "export"|"share"=>{let text=serde_json::to_string_pretty(&a["data"]).map_err(|_|"invalid_data")?;if text.len()>65536{return Err("export_too_large".into())}let chosen=app.dialog().file().add_filter("JSON",&["json"]).set_file_name("delta-export.json").blocking_save_file();if let Some(file)=chosen{let path=file.into_path().map_err(|_|"invalid_destination")?;std::fs::write(path,text).map_err(|_|"export_failed")?;Ok(json!({"saved":true}))}else{Ok(json!({"cancelled":true}))}},
 "notify"=>{use tauri_plugin_notification::NotificationExt;let title=a["title"].as_str().unwrap_or("Delta");let body=a["body"].as_str().unwrap_or("");app.notification().builder().title(title.chars().take(200).collect::<String>()).body(body.chars().take(2000).collect::<String>()).show().map_err(|_|"notification_failed")?;Ok(json!({"sent":true}))},
 _=>Err("unsupported".into())}
}
#[cfg(not(target_os="android"))]
fn prepare_runtime(app:&tauri::AppHandle,home:&std::path::Path)->std::io::Result<()>{
 let target=home.join("runtime");let binary=target.join(if cfg!(windows){"node.exe"}else{"bin/node"});if binary.exists(){return Ok(())}
 let source=app.path().resource_dir().map_err(|_|std::io::Error::other("resources unavailable"))?.join("runtime");if !source.join("release.json").is_file(){return Err(std::io::Error::other("Bundled runtime missing"))}
 fn copy(from:&std::path::Path,to:&std::path::Path)->std::io::Result<()>{std::fs::create_dir_all(to)?;for item in std::fs::read_dir(from)?{let item=item?;let kind=item.file_type()?;if kind.is_dir(){copy(&item.path(),&to.join(item.file_name()))?}else if kind.is_file(){std::fs::copy(item.path(),to.join(item.file_name()))?;}}Ok(())}
 std::fs::create_dir_all(home)?;let stage=home.join(".native-runtime-stage");if stage.exists(){std::fs::remove_dir_all(&stage)?}copy(&source,&stage)?;if target.exists(){return Err(std::io::Error::other("Existing incomplete runtime requires repair"))}std::fs::rename(stage,target)
}
pub fn run(context:tauri::Context<tauri::Wry>){
 let builder=apps::register(tauri::Builder::default()).manage(apps::AppStore(Mutex::new(())));
 #[cfg(not(target_os="android"))]let builder=builder.plugin(tauri_plugin_single_instance::init(|app,args,_cwd|{if let Some(s)=app.try_state::<HostState>(){if let Some(uri)=args.into_iter().find(|v|v.len()<=2048&&v.starts_with("delta://pair?")){*s.pending.lock().unwrap()=Some(uri)}}if let Some(w)=app.get_webview_window("main"){let _=w.show();let _=w.set_focus();}})).plugin(tauri_plugin_autostart::Builder::new().args(["--background"]).build()).plugin(tauri_plugin_dialog::init()).plugin(tauri_plugin_opener::init()).plugin(tauri_plugin_notification::init());
 builder.setup(|app|{
  #[cfg(target_os="android")]let _=android::active().map_err(std::io::Error::other)?;
  #[cfg(not(target_os="android"))]let node={let home=std::env::var_os("DELTA_HOME").map(std::path::PathBuf::from).unwrap_or_else(||{#[cfg(windows)]{std::env::var_os("LOCALAPPDATA").map(std::path::PathBuf::from).unwrap_or_else(std::env::temp_dir).join("Delta")}#[cfg(not(windows))]{app.path().home_dir().unwrap().join(".delta")}});prepare_runtime(app.handle(),&home)?;Arc::new(tauri::async_runtime::block_on(HostRuntime::open(home,"desktop")).map_err(|e|std::io::Error::other(e.code))?)};
  app.manage(HostState{#[cfg(not(target_os="android"))]runtime:node,pending:Mutex::new(std::env::args().find(|v|v.len()<=2048&&v.starts_with("delta://pair?")))});
  #[cfg(not(target_os="android"))]{
   use tauri::{menu::{Menu,MenuItem},tray::TrayIconBuilder};let show=MenuItem::with_id(app,"show","Delta",true,None::<&str>)?;let exit=MenuItem::with_id(app,"exit","Exit / Выход",true,None::<&str>)?;let menu=Menu::with_items(app,&[&show,&exit])?;
   TrayIconBuilder::new().icon(app.default_window_icon().cloned().unwrap()).menu(&menu).on_menu_event(|app,e|{if e.id.as_ref()=="show"{if let Some(w)=app.get_webview_window("main"){let _=w.show();let _=w.set_focus();}}if e.id.as_ref()=="exit"{let app=app.clone();tauri::async_runtime::spawn(async move{let s=app.state::<HostState>();s.runtime.stop().await;app.exit(0);});}}).build(app)?;
   if !std::env::args().any(|s|s=="--background"){if let Some(w)=app.get_webview_window("main"){w.show()?}}
  }
  Ok(())
 }).invoke_handler(tauri::generate_handler![host_info,host_call]).on_window_event(|window,event|{
  #[cfg(not(target_os="android"))]if let tauri::WindowEvent::CloseRequested{api,..}=event{api.prevent_close();let _=window.hide();}
  #[cfg(target_os="android")]let _=(window,event);
 }).run(context).expect("native host startup failed");
}
