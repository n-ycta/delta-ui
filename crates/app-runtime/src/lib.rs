//! Portable static app packages. No executables, filesystem grants or node runtime.
use std::{path::{Path,PathBuf},io::Write};
use serde_json::{Value,json};
use sha2::{Sha256,Digest};
use base64::{Engine,engine::general_purpose::STANDARD};
pub const MAX_PACKAGE:usize=16*1024*1024;
pub const MAX_FILES:usize=1000;
fn fail(s:&str)->std::io::Error{std::io::Error::other(s)}
pub fn digest(b:&[u8])->String{format!("{:x}",Sha256::digest(b))}
pub fn valid_id(id:&str)->bool{!id.is_empty()&&id.len()<100&&id.split('.').all(|p|!p.is_empty()&&p.bytes().all(|c|c.is_ascii_lowercase()||c.is_ascii_digit()||c==b'-'))}
pub fn valid_path(p:&str)->bool{!p.is_empty()&&p.len()<240&&p.split('/').all(|v|!v.is_empty()&&v!="."&&v!=".."&&v.bytes().all(|c|c.is_ascii_alphanumeric()||b"._-".contains(&c)))}
pub fn protocol(id:&str)->String{format!("deltaapp-{}",id.replace('.',"-"))}
pub fn manifest(bytes:&[u8],expected:&Value)->std::io::Result<(Value,Vec<(String,Vec<u8>)>)>{
 if bytes.len()>MAX_PACKAGE||digest(bytes)!=expected["sha256"].as_str().unwrap_or(""){return Err(fail("package_integrity"))}
 let p:Value=serde_json::from_slice(bytes).map_err(|_|fail("invalid_package"))?;
 let m=&p["manifest"];let id=m["id"].as_str().unwrap_or("");
 if p["format"]!="delta-app-v1"||!valid_id(id)||m["id"]!=expected["id"]||m["version"]!=expected["version"]||m["runtime"]["execution"]!="web"||m["entry"]!="index.html"||m["grants"]!=json!([]){return Err(fail("manifest_mismatch"))}
 let files=p["files"].as_array().ok_or_else(||fail("invalid_files"))?;
 if files.is_empty()||files.len()>MAX_FILES{return Err(fail("file_limit"))}
 let mut seen=std::collections::BTreeSet::new();let mut checked=vec![];let mut total=0;
 for f in files{
  let name=f["path"].as_str().unwrap_or("");if !valid_path(name)||!seen.insert(name.to_string()){return Err(fail("unsafe_path"))}
  let encoded=f["data"].as_str().ok_or_else(||fail("invalid_data"))?;if encoded.len()>4*1024*1024{return Err(fail("asset_limit"))}
  let b=STANDARD.decode(encoded).map_err(|_|fail("invalid_base64"))?;total+=b.len();
  if total>12*1024*1024||digest(&b)!=f["sha256"].as_str().unwrap_or(""){return Err(fail("asset_integrity"))}
  checked.push((name.into(),b));
 }
 if !seen.contains("index.html"){return Err(fail("missing_entry"))}
 Ok((m.clone(),checked))
}
pub fn install(root:&Path,bytes:&[u8],expected:&Value)->std::io::Result<Value>{
 let (m,files)=manifest(bytes,expected)?;let id=m["id"].as_str().unwrap();std::fs::create_dir_all(root)?;
 let dest=root.join(id);if dest.exists(){return Err(fail("already_installed"))}
 let stage=root.join(format!(".stage-{}-{}",id,std::process::id()));
 if stage.exists(){std::fs::remove_dir_all(&stage)?}std::fs::create_dir(&stage)?;
 let result=(||{for (path,b) in files {let file=stage.join(path);std::fs::create_dir_all(file.parent().unwrap())?;let mut f=std::fs::OpenOptions::new().write(true).create_new(true).open(file)?;f.write_all(&b)?;f.sync_all()?;}
 std::fs::write(stage.join(".delta-manifest.json"),serde_json::to_vec(&m)?)?;std::fs::rename(&stage,&dest)?;Ok(m)})();
 if result.is_err(){let _=std::fs::remove_dir_all(&stage);}result
}
pub fn list(root:&Path)->Vec<Value>{let Ok(entries)=std::fs::read_dir(root)else{return vec![]};entries.filter_map(|e|{let e=e.ok()?;if e.file_type().ok()?.is_symlink(){return None}let id=e.file_name().to_string_lossy().into_owned();if !valid_id(&id){return None}let b=std::fs::read(e.path().join(".delta-manifest.json")).ok()?;let m:Value=serde_json::from_slice(&b).ok()?;if m["id"]!=id{return None}Some(m)}).collect()}
pub fn asset(root:&Path,id:&str,path:&str)->std::io::Result<PathBuf>{if !valid_id(id)||!valid_path(path)||path==".delta-manifest.json"{return Err(fail("invalid_path"))}let dir=root.join(id).canonicalize()?;let p=dir.join(path).canonicalize()?;if !p.starts_with(&dir)||!p.is_file(){return Err(fail("invalid_path"))}Ok(p)}
pub fn mime(path:&str)->&'static str{match path.rsplit('.').next().unwrap_or(""){"html"=>"text/html; charset=utf-8","js"|"mjs"=>"text/javascript","css"=>"text/css","json"=>"application/json","svg"=>"image/svg+xml","png"=>"image/png","jpg"|"jpeg"=>"image/jpeg","woff2"=>"font/woff2","woff"=>"font/woff",_=>"application/octet-stream"}}
pub const CSP:&str="default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' https: data: blob:; media-src 'self' https: blob:; connect-src https:; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src https://www.youtube-nocookie.com";
#[cfg(test)]mod tests{use super::*;
 fn package()->(Vec<u8>,Value){let b=b"<h1>media</h1>";let p=json!({"format":"delta-app-v1","manifest":{"id":"dev.delta.media","version":"1.0.0","entry":"index.html","runtime":{"execution":"web"},"grants":[]},"files":[{"path":"index.html","data":STANDARD.encode(b),"sha256":digest(b)}]});let bytes=serde_json::to_vec(&p).unwrap();let e=json!({"id":"dev.delta.media","version":"1.0.0","sha256":digest(&bytes)});(bytes,e)}
 #[test]fn validates_integrity_and_identity(){let(b,e)=package();assert!(manifest(&b,&e).is_ok());assert!(manifest(&b,&json!({"sha256":"bad"})).is_err());let mut wrong=e;wrong["id"]=json!("dev.other");assert!(manifest(&b,&wrong).is_err());}
 #[test]fn rejects_paths_links_and_duplicates(){for p in ["/root","../x","x/../y","x\\y","x//y","%2e%2e/x","a:b","."]{assert!(!valid_path(p),"{p}")}let(b,mut e)=package();let mut p:Value=serde_json::from_slice(&b).unwrap();p["files"][0]["path"]=json!("../escape");let b=serde_json::to_vec(&p).unwrap();e["sha256"]=json!(digest(&b));assert!(manifest(&b,&e).is_err());}
 #[test]fn installs_atomically_and_isolates_assets(){let(b,e)=package();let r=std::env::temp_dir().join(format!("delta-app-test-{}",std::process::id()));let _=std::fs::remove_dir_all(&r);install(&r,&b,&e).unwrap();assert_eq!(list(&r).len(),1);assert!(install(&r,&b,&e).is_err());assert!(asset(&r,"dev.delta.media","index.html").is_ok());assert!(asset(&r,"dev.delta.media","../config.json").is_err());assert!(asset(&r,"dev.delta.media",".delta-manifest.json").is_err());std::fs::remove_dir_all(r).unwrap();}
}
