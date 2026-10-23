import { tr } from '../i18n';
export let pendingInvitation='';
const LOOPBACK=/^(localhost|0\.0\.0\.0|\[?::1?\]?|127(\.\d{1,3}){3})$|\.localhost$/i;
/** Accepts http(s) only; a scheme-less host:port is read as http. */
export function pairingAddress(value:string){
 let text=value.trim();if(!/^[a-z][a-z0-9+.-]*:\/\//i.test(text))text='http://'+text;
 let url:URL;try{url=new URL(text)}catch{throw Error(tr('auth.invalidEndpoint'))}
 if(!['https:','http:'].includes(url.protocol)||!url.hostname||url.username||url.password||/[?#]/.test(text)||text.length>512)throw Error(tr('auth.invalidEndpoint'));
 return url.toString().replace(/\/$/,'');
}
/** Reads every format Delta issues: delta://pair link, `delta join <url> <code>` command, or the invite JSON. */
export function parseInvitation(input:string):{url:string;code:string}{
 const bad=()=>Error(tr('native.invalidQr')),text=input.trim();
 if(!text||text.length>2048)throw bad();
 let url='',code='';
 if(text.startsWith('{')){try{const j=JSON.parse(text);url=j.url;code=j.code}catch{throw bad()}}
 else{
  const link=/delta:(?:\/\/\/?)?pair\?(\S*)/i.exec(text),cmd=/\bdelta\s+join\s+(\S+)\s+(\S+)/i.exec(text);
  if(link){for(const[k,v]of new URLSearchParams(link[1])){if(k.toLowerCase()==='url')url=v;if(k.toLowerCase()==='code')code=v}}
  else if(cmd)[,url,code]=cmd;
 }
 if(typeof url!=='string'||typeof code!=='string'||!url.trim()||!code||code.length>256)throw bad();
 let addr:string;try{addr=pairingAddress(url)}catch{throw bad()}
 const u=new URL(addr);
 if(LOOPBACK.test(u.hostname)||u.port==='0')throw Error(tr('native.unreachable'));
 return{url:addr,code};
}
export function takeInvitation(){const value=pendingInvitation;pendingInvitation='';return value;}
export function acceptInvitation(text:string){
 const{url,code}=parseInvitation(text);pendingInvitation=invitationLink(url,code);window.dispatchEvent(new Event('delta:pairing-invitation'));
}
export function invitationLink(url:string,code:string){return 'delta://pair?'+new URLSearchParams({url:pairingAddress(url),code}).toString()}

declare global { interface Window { __deltaAcceptPair?: (text: string) => void } }
if (typeof window !== "undefined") window.__deltaAcceptPair = (text: string) => { try { acceptInvitation(text); } catch { /* the join screen reports a bad link */ } };
