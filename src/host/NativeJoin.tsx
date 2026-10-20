import { useEffect, useState } from 'react';
import jsQR from 'jsqr';
import { hostBridge } from './contract';
import { acceptInvitation, pendingInvitation, takeInvitation, pairingAddress } from './invitations';
import { tr } from '../i18n';
import { Button } from '../ui/primitives';
/** Explicit peer enrollment, not a new personal identity or an automatic admin grant. */
export function NativeJoin({ onConnected, onBusyChange }: { onConnected: (node: string) => Promise<void>; onBusyChange: (busy: boolean) => void }) {
 const host = hostBridge()!;
 const [url,setUrl]=useState(''),[code,setCode]=useState(''),[link,setLink]=useState('');
 const [trust,setTrust]=useState(false),[services,setServices]=useState(true);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[joined,setJoined]=useState('');
 useEffect(()=>{onBusyChange(busy);return()=>onBusyChange(false)},[busy,onBusyChange]);
 const readPending=()=>{if(pendingInvitation){const u=new URL(takeInvitation());setUrl(u.searchParams.get('url')||'');setCode(u.searchParams.get('code')||'');setLink('');}};
 useEffect(()=>{readPending();window.addEventListener('delta:pairing-invitation',readPending);return()=>window.removeEventListener('delta:pairing-invitation',readPending)},[]);
 const parseLink=()=>{try{acceptInvitation(link.trim());readPending();setError('')}catch{setError(tr('native.invalidQr'))}};
 async function scan(file:File){setBusy(true);setError('');try{const bitmap=await createImageBitmap(file);try{if(bitmap.width*bitmap.height>16000000)throw Error(tr('native.invalidQr'));const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;const ctx=canvas.getContext('2d')!;ctx.drawImage(bitmap,0,0);const image=ctx.getImageData(0,0,canvas.width,canvas.height),result=jsQR(image.data,image.width,image.height);if(!result)throw Error(tr('native.invalidQr'));acceptInvitation(result.data);readPending()}finally{bitmap.close()}}catch{setError(tr('native.invalidQr'))}finally{setBusy(false)}}
 async function connect(){setBusy(true);setError('');try{let node=joined;if(!node){const result=await host.call({capability:'peers.join',args:{url:pairingAddress(url),code:code.trim(),trust_admin:trust}}) as {node_id:string};node=result.node_id;if(!node)throw Error(tr('onboarding.invalidPeer'));setJoined(node);setCode('');}const info=await host.call({capability:'core.info',node}) as {node_id:string};if(info.node_id!==node)throw Error(tr('onboarding.invalidPeer'));if(services)await host.call({capability:'host.services',args:{node}});await onConnected(node)}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 return <div className="col gap-3">
  <p className="muted">{tr('onboarding.connectHint')}</p>
  {error&&<div className="banner err" role="alert">{error}</div>}
  {!joined&&<>
   <label>{tr('onboarding.invitationLink')}<input className="input" disabled={busy} value={link} onChange={e=>setLink(e.target.value)} maxLength={2048} autoComplete="off" spellCheck={false}/></label>
   <div className="row gap-2" style={{flexWrap:'wrap'}}><Button disabled={busy||!link.trim()} onClick={parseLink}>{tr('onboarding.useInvitation')}</Button><label className="btn" style={{minHeight:44}}>{tr('native.scan')}<input aria-label={tr('native.scan')} type="file" accept="image/*" capture="environment" hidden disabled={busy} onChange={e=>{const f=e.target.files?.[0];if(f)void scan(f);e.target.value=''}}/></label></div>
   <label>{tr('native.url')}<input className="input" disabled={busy} type="url" value={url} onChange={e=>setUrl(e.target.value)} maxLength={512} autoComplete="off" spellCheck={false}/></label>
   <label>{tr('native.code')}<input className="input" disabled={busy} type="password" value={code} onChange={e=>setCode(e.target.value)} maxLength={256} autoComplete="off" spellCheck={false}/></label>
   <label className="check"><input type="checkbox" disabled={busy} checked={trust} onChange={e=>setTrust(e.target.checked)}/>{tr('native.trust')}</label>
  </>}
  {joined&&<p role="status">{tr('onboarding.peerJoined')}</p>}
  <label className="check"><input type="checkbox" checked={services} disabled={busy} onChange={e=>setServices(e.target.checked)}/>{tr('onboarding.useServices')}</label>
  <p className="muted">{tr('native.network')}</p>
  <Button variant="primary" disabled={busy||(!joined&&(!url.trim()||!code.trim()))} onClick={()=>void connect()}>{tr(joined?'onboarding.continue':'native.join')}</Button>
 </div>;
}
