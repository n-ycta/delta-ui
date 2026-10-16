import { useEffect, useState } from 'react';
import { RefreshCw } from '../ui/icons';
import { tr } from '../i18n';
import type { HostBridge, HostInfo } from './contract';
interface Snapshot {host:HostInfo;core:Record<string,unknown>;components:Record<string,unknown>[];caps:Record<string,unknown>[]}
/** Same UI package on every native host. Never fake unavailable Web services or telemetry. */
export function NativeHome({bridge}:{bridge:HostBridge}) {
 const [snapshot,setSnapshot]=useState<Snapshot>();const [error,setError]=useState(false);const [busy,setBusy]=useState(false);
 const refresh=async()=>{setBusy(true);try{const [host,core,components,caps]=await Promise.all([bridge.info(),bridge.call({capability:'core.info'}),bridge.call({capability:'core.components'}),bridge.call({capability:'core.capabilities'})]);setSnapshot({host,core:core as Record<string,unknown>,components:components as Record<string,unknown>[],caps:caps as Record<string,unknown>[]});setError(false)}catch{setError(true)}finally{setBusy(false)}};
 useEffect(()=>{document.documentElement.dataset.theme='dark';void refresh();const timer=setInterval(()=>void refresh(),30000);return()=>clearInterval(timer)},[bridge]);
 return <main className="page" style={{maxWidth:1400,margin:'auto',padding:24}}>
  <header className="page-head"><div><h1>{tr('host.title')}</h1><p className="sub">{snapshot?.host.kind} {" · "}{tr('host.ui')} {snapshot?.host.uiVersion} {" · "}{tr('host.version')} {snapshot?.host.version}</p></div><button className="btn" disabled={busy} title={tr('host.refresh')} aria-label={tr('host.refresh')} onClick={()=>void refresh()}><RefreshCw size={16}/></button></header>
  <div className="banner info" role="note">{tr('host.experimental')}</div>
  {error&&<div className="banner err" role="alert">{tr('host.unavailable')}</div>}
  {snapshot&&<>
   <section className="panel"><div className="panel-head"><h2 className="panel-title">{tr('host.identity')}</h2></div><div className="panel-body"><p>{tr('host.node')}{": "}{String(snapshot.core.name)} {" · "}{String(snapshot.core.node_id)}</p><p>{tr('host.version')}{": "}{String(snapshot.core.version)}</p><p>{tr(snapshot.host.lifecycle==='external'?'host.external':snapshot.host.lifecycle==='tray'?'host.tray':'host.foreground')}</p><p>{tr('host.features')}{": "}{snapshot.host.features.join(', ')}</p></div></section>
   <section className="panel"><div className="panel-head"><h2 className="panel-title">{tr('host.components')}</h2></div><div className="table-wrap"><table><thead><tr><th>{tr('host.node')}</th><th>{tr('host.version')}</th></tr></thead><tbody>{snapshot.components.map(c=><tr key={String(c.id)}><td>{String(c.id)}</td><td>{String(c.version)}</td></tr>)}</tbody></table></div></section>
   <section className="panel"><div className="panel-head"><h2 className="panel-title">{tr('host.capabilities')}</h2></div><div className="table-wrap"><table><tbody>{snapshot.caps.map(c=><tr key={String(c.name)}><td>{String(c.name)}</td><td>{String(c.description||'')}</td></tr>)}</tbody></table></div></section>
  </>}
 </main>;
}
