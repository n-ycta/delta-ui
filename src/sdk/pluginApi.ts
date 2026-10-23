import { hostBridge, type HostBridge } from '../host/contract';
import { readConnectionSettings } from '../api';
/** Approved capabilities for Media's interface; never a wildcard or a raw core token. */
export const MEDIA_API = ['media.providers','media.browse','media.search','media.resolve','media.library','media.play','media.pause','media.seek','media.next','media.previous','media.queue','media.playlists','media.settings','media.stats','media.session','media.sync','downloads.status','downloads.create','downloads.job','downloads.cancel','downloads.read','downloads.remove'] as const;
export const LIFEOS_API = ["lifeos.status", "lifeos.task_list", "lifeos.task_create", "lifeos.task_update", "lifeos.task_delete", "lifeos.entry_list", "lifeos.entry_create", "lifeos.entry_update", "lifeos.entry_delete", "lifeos.practice_list", "lifeos.practice_create", "lifeos.practice_update", "lifeos.practice_delete", "lifeos.project_list", "lifeos.project_create", "lifeos.project_update", "lifeos.project_delete", "lifeos.direction_list", "lifeos.direction_create", "lifeos.direction_update", "lifeos.direction_delete", "lifeos.skill_list", "lifeos.skill_create", "lifeos.skill_update", "lifeos.skill_delete", "lifeos.evidence_list", "lifeos.evidence_create", "lifeos.evidence_update", "lifeos.evidence_delete", "lifeos.experiment_list", "lifeos.experiment_create", "lifeos.experiment_update", "lifeos.experiment_delete", "lifeos.task_complete", "lifeos.task_reopen", "lifeos.practice_log", "lifeos.calendar", "lifeos.summary", "lifeos.settings_get", "lifeos.settings_update", "lifeos.export", "lifeos.workspace_read", "lifeos.workspace_begin", "lifeos.workspace_chunk", "lifeos.workspace_commit"] as const;
export function pluginGrants(id: string): readonly string[] { return id === "dev.delta.media" ? MEDIA_API : id === "dev.delta.lifeos" ? LIFEOS_API : []; }
const NODE_TTL_MS = 60_000;
const remoteNode = new Map<string, { at: number; node: string | undefined }>();
/**
 * Local-first: the common single-node call makes exactly one host call. Only when the local core answers
 * not_found do we look for a peer serving the capability, and remember that decision for 60 s.
 */
export async function pluginHostCall(host: HostBridge, capability: string, args: Record<string, unknown>, now = Date.now()) {
  const hit = remoteNode.get(capability);
  const fresh = !!hit && now - hit.at < NODE_TTL_MS;
  if (fresh && hit!.node) return host.call({ capability, args, node: hit!.node });
  try { return await host.call({ capability, args }); }
  catch (e) {
    if (fresh || (e as any)?.code !== 'not_found') throw e;
    const node = await findPluginNode(host, capability);
    remoteNode.set(capability, { at: now, node });
    if (!node) throw e;
    return host.call({ capability, args, node });
  }
}
async function findPluginNode(host: HostBridge, capability: string): Promise<string | undefined> {
  const local = await host.call({ capability: 'core.capabilities' }).catch(() => []);
  if (Array.isArray(local) && local.some((c: any) => c?.name === capability)) return undefined;
  const peers = await host.call({ capability: 'peers.list' }).catch(() => []);
  for (const peer of Array.isArray(peers) ? peers : []) {
    if (!peer?.node_id || peer.online === false || peer.trusted_admin === false) continue;
    const remote = await host.call({ capability: 'core.capabilities', node: peer.node_id }).catch(() => []);
    if (Array.isArray(remote) && remote.some((c: any) => c?.name === capability)) return peer.node_id;
  }
  return undefined;
}
export async function pluginApiCall(id: string, capability: string, args: Record<string, unknown> = {}) {
  if (!pluginGrants(id).includes(capability)) throw Error('forbidden');
  const host = hostBridge(); if (host) return pluginHostCall(host, capability, args);
  const token = readConnectionSettings().token;
  const response = await fetch('/apps/call', { method:'POST', credentials:'same-origin', headers:{ 'content-type':'application/json', ...(token ? {authorization:'Bearer '+token} : {}) }, body:JSON.stringify({ id, capability, args }) });
  const value = await response.json();
  if (!response.ok) throw Error(value.error || 'operation_failed');
  return value;
}
