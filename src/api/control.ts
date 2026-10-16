import {hostBridge} from '../host/contract';
import {tr,language} from '../i18n';
import { readConnectionSettings } from './index';
/** Owner/control-plane calls share the same original-user transport as the regular adapter. */
export async function control(capability:string,args:unknown={},node?:string):Promise<any>{
 const host=hostBridge();if(host)return host.call({capability,args:{...(args as object),_locale:language},...(node?{node}:{})});
 const s=readConnectionSettings();if(s.mode==='mock')throw Error(tr('polish.liveRequired'));
 const r=await fetch(s.baseUrl.replace(/\/$/,'').replace(/\/v1$/,'')+'/v1/call',{method:'POST',headers:{'content-type':'application/json',...(s.token?{authorization:'Bearer '+s.token}:{})},body:JSON.stringify({capability,args:{...(args as object),_locale:language},...(node?{node}:{})})});
 const data=await r.json();if(!r.ok||!data.ok)throw Object.assign(Error(data.error?.message||tr('polish.requestFailed')),{code:data.error?.code,status:r.status});return data.result;
}
