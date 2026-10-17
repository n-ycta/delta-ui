import { hostBridge } from '../host/contract';
import { readConnectionSettings } from '../api';
/** Approved capabilities for Media's interface; never a wildcard or a raw core token. */
export const MEDIA_API = ['media.providers','media.browse','media.search','media.resolve','media.library','media.play','media.pause','media.seek','media.next','media.previous','media.queue','media.playlists','media.settings','media.stats','media.session','media.sync','downloads.status','downloads.create','downloads.job','downloads.cancel','downloads.read','downloads.remove'] as const;
export const VECTOR_API = ["vector.task_list","vector.task_create","vector.task_update","vector.task_delete","vector.entry_list","vector.entry_create","vector.entry_update","vector.entry_delete","vector.practice_list","vector.practice_create","vector.practice_update","vector.practice_delete","vector.project_list","vector.project_create","vector.project_update","vector.project_delete","vector.direction_list","vector.direction_create","vector.direction_update","vector.direction_delete","vector.skill_list","vector.skill_create","vector.skill_update","vector.skill_delete","vector.evidence_list","vector.evidence_create","vector.evidence_update","vector.evidence_delete","vector.experiment_list","vector.experiment_create","vector.experiment_update","vector.experiment_delete","vector.status","vector.task_complete","vector.task_reopen","vector.practice_log","vector.calendar","vector.summary","vector.settings_get","vector.settings_update","vector.export"] as const;
export function pluginGrants(id: string): readonly string[] { return id === "dev.delta.media" ? MEDIA_API : id === "dev.delta.vector" ? VECTOR_API : []; }
export async function pluginApiCall(id: string, capability: string, args: Record<string, unknown> = {}) {
  if (!pluginGrants(id).includes(capability)) throw Error('forbidden');
  const host = hostBridge(); if (host) return host.call({ capability, args });
  const token = readConnectionSettings().token;
  const response = await fetch('/apps/call', { method:'POST', credentials:'same-origin', headers:{ 'content-type':'application/json', ...(token ? {authorization:'Bearer '+token} : {}) }, body:JSON.stringify({ id, capability, args }) });
  const value = await response.json();
  if (!response.ok) throw Error(value.error || 'operation_failed');
  return value;
}
