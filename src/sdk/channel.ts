import { validateRequest, type CapabilityRequest } from '../host/contract';
/** Authorization belongs to the parent. This broker never hands its transport or credentials to a plugin. */
export function pluginChannel(options: { source: Window; origin: string; grants: ReadonlySet<string>; call(request: CapabilityRequest):Promise<unknown> }) {
 const nonce=crypto.randomUUID();let revoked=false;let active=0;
 const receive=async(event:MessageEvent)=>{
  if (revoked||event.source!==options.source||event.origin!==options.origin||event.data?.channel!==nonce) return;
  const {id,request}=event.data;
  if(typeof id!=='string'||id.length>80) return;
  let reply:unknown;
  try {validateRequest(request);if(request.node||!options.grants.has(request.capability))throw Error('forbidden');if(active>=4)throw Error('busy');active++;try{reply={ok:true,result:await options.call(request)}}finally{active--}}
  catch(e){const safe=['forbidden','busy','invalid_request','conflict','not_found','bad_request','capacity','unavailable'];const value=e instanceof Error?((e as Error & {code?:string}).code||e.message):'';reply={ok:false,error:{code:safe.includes(value)?value:'operation_failed'}}}
  if(!revoked)options.source.postMessage({channel:nonce,id,...(reply as object)},options.origin==='null'?'*':options.origin);
 };
 window.addEventListener('message',receive);
 return {channel:nonce,revoke(){revoked=true;window.removeEventListener('message',receive)}};
}
