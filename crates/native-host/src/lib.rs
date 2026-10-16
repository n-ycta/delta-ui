//! Thin shared Tauri adapter. Windows/Linux and Android embed the same Rust core and UI.
use std::sync::Arc;
use delta_host_runtime::HostRuntime;
use serde_json::{json,Value};
use tauri::{Manager,State,WebviewWindow};
struct HostState(Arc<HostRuntime>);
fn trusted(window:&WebviewWindow)->Result<(),Value>{
 let url=window.url().map_err(|_|json!({"code":"forbidden"}))?;
 if window.label()!="main"||!(url.scheme()=="tauri"||(["http","https"].contains(&url.scheme())&&url.host_str()==Some("tauri.localhost"))) {return Err(json!({"code":"forbidden"}))}
 Ok(())
}
#[tauri::command]
async fn host_info(window:WebviewWindow,state:State<'_,HostState>)->Result<Value,Value>{trusted(&window)?;Ok(state.0.info(env!("CARGO_PKG_VERSION"),"0.1.0"))}
#[tauri::command]
async fn host_call(window:WebviewWindow,state:State<'_,HostState>,request:Value)->Result<Value,Value>{trusted(&window)?;state.0.call(request).await.map_err(|e|e.to_value())}
pub fn run(context:tauri::Context<tauri::Wry>){
 tauri::Builder::default().setup(|app|{
  #[cfg(target_os="android")]
  let (home,kind)=(app.path().app_data_dir()?.join("node"),"android");
  #[cfg(not(target_os="android"))]
  let (home,kind)=(std::env::var_os("DELTA_HOME").map(std::path::PathBuf::from).unwrap_or(app.path().home_dir()?.join(".delta")),"desktop");
  let runtime=tauri::async_runtime::block_on(HostRuntime::open(home,kind)).map_err(|e|std::io::Error::other(e.code))?;
  app.manage(HostState(Arc::new(runtime)));
  #[cfg(not(target_os="android"))]
  {
   use tauri::{menu::{Menu,MenuItem},tray::TrayIconBuilder};
   let show=MenuItem::with_id(app,"show","Delta",true,None::<&str>)?;
   let exit=MenuItem::with_id(app,"exit","Exit node / Завершить узел",true,None::<&str>)?;
   let menu=Menu::with_items(app,&[&show,&exit])?;
   let mut rgba=vec![0u8;16*16*4];for pixel in rgba.chunks_mut(4){pixel.copy_from_slice(&[108,85,255,255]);}
   TrayIconBuilder::new().icon(tauri::image::Image::new_owned(rgba,16,16)).menu(&menu).on_menu_event(|app,event|{
    if event.id.as_ref()=="show" {if let Some(w)=app.get_webview_window("main"){let _=w.show();let _=w.set_focus();}}
    if event.id.as_ref()=="exit" {let app=app.clone();tauri::async_runtime::spawn(async move {let state=app.state::<HostState>();state.0.stop().await;app.exit(0);});}
   }).build(app)?;
  }
  Ok(())
 }).invoke_handler(tauri::generate_handler![host_info,host_call])
 .on_window_event(|window,event|{
  #[cfg(not(target_os="android"))]
  if let tauri::WindowEvent::CloseRequested{api,..}=event {api.prevent_close();let _=window.hide();}
  #[cfg(target_os="android")]
  let _=(window,event);
 }).run(context).expect("native host startup failed");
}
