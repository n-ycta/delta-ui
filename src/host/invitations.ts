import { tr } from '../i18n';
export let pendingInvitation='';
export function pairingAddress(value:string){
 let url:URL;try{url=new URL(value.trim())}catch{throw Error(tr('auth.invalidEndpoint'))}
 if(!['https:','http:'].includes(url.protocol)||!url.hostname||url.username||url.password||url.hash||url.search||value.length>512)throw Error(tr('auth.invalidEndpoint'));
 return url.toString().replace(/\/$/,'');
}
export function takeInvitation(){const value=pendingInvitation;pendingInvitation='';return value;}
export function acceptInvitation(text:string){
 try{const u=new URL(text),code=u.searchParams.get('code');if(u.protocol!=='delta:'||u.hostname!=='pair'||!u.searchParams.get('url')||!code||code.length>256||text.length>2048)throw Error();pairingAddress(u.searchParams.get('url')!);pendingInvitation=text;window.dispatchEvent(new Event('delta:pairing-invitation'));}catch{throw Error(tr('native.invalidQr'))}
}
export function invitationLink(url:string,code:string){return 'delta://pair?'+new URLSearchParams({url:pairingAddress(url),code}).toString()}

declare global { interface Window { __deltaAcceptPair?: (text: string) => void } }
if (typeof window !== "undefined") window.__deltaAcceptPair = (text: string) => { try { acceptInvitation(text); } catch { /* the join screen reports a bad link */ } };
