import {useEffect,useState} from 'react';
import {Eye,EyeSlash,Copy,DownloadSimple,Check} from '@phosphor-icons/react';
import {tr} from '../i18n';
import {Button} from './primitives';
import {hostBridge} from '../host/contract';
/** Recovery material stays in memory; hidden text is not mounted in the DOM. */
export function RecoverySecret({value}:{value:string}){
 const [shown,setShown]=useState(false),[copied,setCopied]=useState(false),[error,setError]=useState('');
 useEffect(()=>{setShown(false);setCopied(false);const hide=()=>{if(document.hidden)setShown(false)};document.addEventListener('visibilitychange',hide);return()=>document.removeEventListener('visibilitychange',hide)},[value]);
 async function copy(){try{if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(value);else{const input=document.createElement('textarea');input.value=value;input.style.position='fixed';input.style.opacity='0';document.body.append(input);input.select();try{if(!document.execCommand('copy'))throw Error()}finally{input.value='';input.remove()}}setCopied(true);setError('')}catch{setError(tr('recovery.copyFailed'))}}
 async function download(){try{const text='# Delta — '+tr('polish.recoveryPhrase')+'\n\n'+value+'\n\n'+tr('recovery.fileWarning')+'\n';const host=hostBridge();if(host){await host.call({capability:'host.export',args:{format:'markdown',text}})}else{const blob=new Blob([text],{type:'text/markdown;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='delta-recovery.md';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}setError('')}catch{setError(tr('recovery.downloadFailed'))}}

 return <div className="recovery-secret"><div className="row gap-2"><strong className="grow">{tr('polish.recoveryPhrase')}</strong><Button type="button" variant="ghost" iconOnly aria-label={tr(shown?'recovery.hide':'recovery.show')} title={tr(shown?'recovery.hide':'recovery.show')} aria-pressed={shown} onClick={()=>setShown(!shown)}>{shown?<EyeSlash size={18}/>:<Eye size={18}/>}</Button><Button type="button" variant="ghost" iconOnly aria-label={tr('recovery.copy')} title={tr('recovery.copy')} onClick={()=>void copy()}>{copied?<Check size={18}/>:<Copy size={18}/>}</Button><Button type="button" variant="ghost" iconOnly aria-label={tr('recovery.download')} title={tr('recovery.download')} onClick={()=>void download()}><DownloadSimple size={18}/></Button></div>{shown?<code className="recovery-phrase" data-recovery-secret>{value}</code>:<div className="recovery-phrase muted" aria-hidden="true">{'•••• •••• •••• ••••'}</div>}{copied&&<span role="status" className="field-help">{tr('recovery.copied')}</span>}{error&&<span role="alert" className="field-error">{error}</span>}</div>
}
