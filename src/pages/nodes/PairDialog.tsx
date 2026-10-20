import { Select } from '../../ui/Select';
import { SSHConnectDialog } from './SSHConnectDialog';
import { tr } from '../../i18n';
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Copy, Smartphone, Server, Monitor } from '../../ui/icons';
import { useMutation } from '../../app/query';
import { Modal } from '../../ui/overlays';
import { Button, Field, Segmented } from '../../ui/primitives';
import { NODE_KIND_LABEL } from '../../core/contracts';
import { invitationLink, pairingAddress } from '../../host/invitations';
import type { PairingTicket } from '../../api';
export function PairDialog({ open, onClose }: { open:boolean; onClose:()=>void }) {
 const [method,setMethod]=useState<'choose'|'ssh'|'direct'>('choose');
 const [kind,setKind]=useState('android'),[hub,setHub]=useState(''),[device,setDevice]=useState(''),[os,setOs]=useState('linux');
 const [trustHub,setTrustHub]=useState(false),[trustRemote,setTrustRemote]=useState(false);
 const [ticket,setTicket]=useState<PairingTicket|null>(null),[now,setNow]=useState(Date.now()),[qr,setQr]=useState(''),[error,setError]=useState(''),[copied,setCopied]=useState(false);
 const android=kind==='android';
 const create=useMutation(api=>api.createPairingTicket(kind,`${kind}-new`,{trustAdmin:trustRemote}),{onSuccess:t=>{setNow(Date.now());setTicket(t)}});
 useEffect(()=>{if(open){setMethod('choose');setTicket(null);setQr('');setError('');setTrustHub(false);setTrustRemote(false);setCopied(false)}},[open]);
 useEffect(()=>{if(!ticket)return;const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer)},[ticket]);
 const left=ticket?Math.max(0,Math.round((ticket.expiresAt-now)/1000)):0;
 const valid=(v:string)=>{try{pairingAddress(v);return true}catch{return false}};
 const link=ticket&&valid(hub)?invitationLink(hub,ticket.code):'';
 useEffect(()=>{let active=true;setQr('');if(link&&android)void QRCode.toDataURL(link,{width:256,margin:2,errorCorrectionLevel:'M'}).then(v=>{if(active)setQr(v)}).catch(()=>{if(active)setError(tr('pairing.qrFailed'))});return()=>{active=false}},[link,android]);
 const quote=(v:string)=>"'"+v.replaceAll("'",os==='linux'?"'\"'\"'":"''")+"'";
 const command=ticket&&!android?(os==='linux'?`curl -fsSL https://raw.githubusercontent.com/n-ycta/delta/main/install.sh -o /tmp/delta-install.sh && sh /tmp/delta-install.sh --plugins none --listen 0.0.0.0 --public-url ${quote(device)} --join-url ${quote(hub)} --join-code ${quote(ticket.code)} ${trustHub?'--trust-hub':''}`:`$p=Join-Path $env:TEMP 'delta-install.ps1'; Invoke-WebRequest https://raw.githubusercontent.com/n-ycta/delta/main/install.ps1 -OutFile $p; & $p -Plugins 'none' -Listen '0.0.0.0' -PublicUrl ${quote(device)} -JoinUrl ${quote(hub)} -JoinCode ${quote(ticket.code)} ${trustHub?'-TrustHub':''}`):'';
 async function copy(text:string){setError('');try{await navigator.clipboard.writeText(text);setCopied(true)}catch{setError(tr('pairing.copyFailed'))}}
 if(method==='ssh')return <SSHConnectDialog open={open} onClose={onClose} onDirect={()=>{setKind('android');setMethod('direct')}}/>;
 return <Modal open={open} onClose={onClose} title={tr('pages.nodes.PairDialog.s_3f9a7c101f')} footer={method==='choose'||ticket?<Button onClick={onClose}>{tr('pairing.close')}</Button>:<><Button variant="ghost" onClick={()=>setMethod('choose')}>{tr('onboarding.back')}</Button><Button variant="primary" loading={create.pending} disabled={!valid(hub)||(!android&&!valid(device))} onClick={()=>create.run()}>{tr('pairing.createInvitation')}</Button></>}>
  {method==='choose'?<div className="col gap-3">
   <Button variant="primary" icon={<Smartphone size={18}/>} onClick={()=>{setKind('android');setMethod('direct')}}>{tr('pairing.android')}</Button>
   <Button icon={<Monitor size={18}/>} onClick={()=>{setKind('desktop');setMethod('direct')}}>{tr('pairing.computer')}</Button>
   <Button icon={<Server size={18}/>} onClick={()=>setMethod('ssh')}>{tr('ssh.useSSH')}</Button>
   <p className="muted">{tr('pairing.chooseHint')}</p>
  </div>:!ticket?<div className="col gap-3">
   <Field label={tr('pages.nodes.PairDialog.s_56ef096f5e')}><Segmented sans value={kind} onChange={setKind} options={Object.entries(NODE_KIND_LABEL).map(([value,label])=>({value,label}))}/></Field>
   <p className="muted">{tr(android?'pairing.androidHint':'polish.remoteHint')}</p>
   <Field label={tr('polish.hubUrl')} help={tr('pairing.coreAddress')}><input className="input" type="url" value={hub} onChange={e=>setHub(e.target.value)} maxLength={512} autoComplete="off" spellCheck={false}/></Field>
   {!android&&<>
    <Field label={tr('polish.deviceUrl')}><input className="input" type="url" value={device} onChange={e=>setDevice(e.target.value)} maxLength={512}/></Field>
    <Select className="select" value={os} onChange={e=>setOs(e.target.value)}><option value="linux">{'Linux'}</option><option value="windows">{'Windows'}</option></Select>
    <label className="check"><input type="checkbox" checked={trustHub} onChange={e=>setTrustHub(e.target.checked)}/>{tr('polish.trustHub')}</label>
   </>}
   <label className="check"><input type="checkbox" checked={trustRemote} onChange={e=>setTrustRemote(e.target.checked)}/>{tr('pairing.remoteAdmin')}</label>
   <p className="muted">{tr('pairing.accessHint')}</p>
   {create.error&&<div role="alert" className="banner err">{create.error.message}</div>}
  </div>:<div className="col gap-3">
   <p className="muted mono">{tr('pairing.expires',{minutes:Math.floor(left/60),seconds:String(left%60).padStart(2,'0')})}</p>
   {left===0&&<div role="alert" className="banner err">{tr('pairing.expired')}</div>}
   {android?<>
    {qr&&<img src={qr} alt={tr('native.qr')} style={{width:256,maxWidth:'100%',alignSelf:'center',borderRadius:8}}/>}
    <Field label={tr('onboarding.invitationLink')}><input className="input" readOnly value={link} onFocus={e=>e.target.select()}/></Field>
    <Button disabled={!left} icon={<Copy size={16}/>} onClick={()=>void copy(link)}>{tr(copied?'pairing.copied':'pairing.copyLink')}</Button>
    <p>{tr('pairing.phoneSteps')}</p>
    <a href="https://github.com/n-ycta/delta-android/releases/latest/download/Delta-Android-arm64-x86_64.apk" target="_blank" rel="noreferrer">{tr('pairing.downloadAndroid')}</a>
    <p className="muted">{tr('pairing.phoneNetwork')}</p>
   </>:<Field label={tr('pages.nodes.PairDialog.s_562381ef14')}><pre className="code" style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{command}</pre><Button disabled={!left} icon={<Copy size={16}/>} onClick={()=>void copy(command)}>{tr('pages.nodes.PairDialog.s_4a05d8619d')}</Button></Field>}
   <Button onClick={()=>{setTicket(null);setCopied(false)}}>{tr('pairing.newInvitation')}</Button>
   {error&&<div role="alert" className="banner err">{error}</div>}
  </div>}
 </Modal>;
}
