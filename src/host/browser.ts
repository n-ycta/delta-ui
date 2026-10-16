import type { HostBridge, HostInfo, CapabilityRequest } from './contract';
import { validateRequest, compatibleBridge } from './contract';
/** A native host injects only Tauri IPC, never a bearer token. No HTTP fallback on native failure. */
export async function discoverHost(): Promise<HostBridge | undefined> {
 const internals=(window as unknown as {__TAURI_INTERNALS__?:{invoke<T>(command:string,args?:unknown):Promise<T>}}).__TAURI_INTERNALS__;
 if (!internals) return;
 const info=await internals.invoke<HostInfo>('host_info');
 if (!info || !compatibleBridge(info.bridgeVersion)) throw Error('incompatible_host_bridge');
 if (!['web','desktop','android'].includes(info.kind) || typeof info.version!=='string' || typeof info.uiVersion!=='string' || !Array.isArray(info.features) || info.features.length>128 || info.features.some(f=>typeof f!=='string'||f.length>128)) throw Error('invalid_host_info');
 return {info:async()=>info,call:async(request:CapabilityRequest)=>{validateRequest(request);return internals.invoke('host_call',{request});}};
}
