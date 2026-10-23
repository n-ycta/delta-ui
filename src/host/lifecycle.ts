import {installNativeLinkHandler} from './navigation';
import {hostBridge} from './contract';import {acceptInvitation} from './invitations';import {tr} from '../i18n';import {dueForCheck,normalizeUpdatePrefs} from './updates';
/** OS actions remain private IPC; external content never navigates the privileged document. */
export function startNativeLifecycle(){const host=hostBridge()!;installNativeLinkHandler(document,url=>host.call({capability:'host.open',args:{url}}));
 let busy=false,lastNotifications=0;const seen=new Set<string>();async function poll(){if(busy)return;busy=true;try{const s=await host.call({capability:'host.platform_status'}) as any;if(s.pendingPairing){acceptInvitation(s.pendingPairing);location.hash='#/settings?tab=connection'}if(typeof s.pendingRoute==='string'&&/^\/plugins\/[a-zA-Z0-9_.-]+$/.test(s.pendingRoute))location.hash='#'+s.pendingRoute;
 if((await host.info()).kind==='desktop'&&Date.now()-lastNotifications>=30000){lastNotifications=Date.now();const prefs=await host.call({capability:'host.document_list',args:{namespace:'preferences'}}) as any[];if(prefs.some(p=>p.id==='notifications'&&p.enabled)){const notified=prefs.find(p=>p.id==='os-notified')?.keys||[];const rows=await host.call({capability:'web.notifications_list',args:{}}) as any[];for(const n of rows.slice(0,20)){if(seen.has(n.id)||notified.includes(n.id)||n.read)continue;await host.call({capability:'host.notify',args:{title:n.title,body:n.body||''}});seen.add(n.id);notified.push(n.id);while(notified.length>500||JSON.stringify(notified).length>50000)notified.shift();await host.call({capability:'host.document_put',args:{namespace:'preferences',key:'os-notified',value:{id:'os-notified',keys:notified}}})}}}
 }catch{/* Offline host: retain UI and retry, never fall back to HTTP. */}finally{busy=false}}
 /** Android: one background check per 6 h when enabled; the user is told once per version, nothing downloads by itself. */
 let checkingUpdates=false;async function autoUpdateCheck(){if(checkingUpdates)return;checkingUpdates=true;try{const info=await host.info();if(!info.features.includes('app-update'))return;
  const docs=await host.call({capability:'host.document_list',args:{namespace:'preferences'}}) as any[];const prefs=normalizeUpdatePrefs(docs.find(d=>d.id==='updates'));if(!dueForCheck(prefs,Date.now()))return;
  const found=await host.call({capability:'host.update_check',args:{channel:prefs.channel}}) as any;const next={...prefs,lastCheck:Date.now()};
  if(found.available&&typeof found.latest==='string'&&found.latest!==prefs.notified){await host.call({capability:'host.notify',args:{title:tr('nativeUpdate.notifyTitle'),body:tr('nativeUpdate.notifyBody',{version:found.latest})}});next.notified=found.latest}
  await host.call({capability:'host.document_put',args:{namespace:'preferences',key:'updates',value:next}})}catch{/* offline or notifications off: retry at the next due time */}finally{checkingUpdates=false}}
 void autoUpdateCheck();setInterval(()=>void autoUpdateCheck(),600000);
 void poll();setInterval(()=>void poll(),2000);
}
