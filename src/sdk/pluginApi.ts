import { hostBridge } from '../host/contract';
import { readConnectionSettings } from '../api';
/** Approved capabilities for Media's interface; never a wildcard or a raw core token. */
export const MEDIA_API = ['media.providers','media.browse','media.search','media.resolve','media.library','media.play','media.pause','media.seek','media.next','media.previous','media.queue','media.playlists','media.settings','media.stats','media.session','media.sync','downloads.status','downloads.create','downloads.job','downloads.cancel','downloads.read','downloads.remove'] as const;
export const LIFEOS_API = ["lifeos.status", "lifeos.task_list", "lifeos.task_create", "lifeos.task_update", "lifeos.task_delete", "lifeos.entry_list", "lifeos.entry_create", "lifeos.entry_update", "lifeos.entry_delete", "lifeos.practice_list", "lifeos.practice_create", "lifeos.practice_update", "lifeos.practice_delete", "lifeos.project_list", "lifeos.project_create", "lifeos.project_update", "lifeos.project_delete", "lifeos.direction_list", "lifeos.direction_create", "lifeos.direction_update", "lifeos.direction_delete", "lifeos.skill_list", "lifeos.skill_create", "lifeos.skill_update", "lifeos.skill_delete", "lifeos.evidence_list", "lifeos.evidence_create", "lifeos.evidence_update", "lifeos.evidence_delete", "lifeos.experiment_list", "lifeos.experiment_create", "lifeos.experiment_update", "lifeos.experiment_delete", "lifeos.task_complete", "lifeos.task_reopen", "lifeos.practice_log", "lifeos.calendar", "lifeos.summary", "lifeos.settings_get", "lifeos.settings_update", "lifeos.export", "lifeos.workspace_read", "lifeos.workspace_begin", "lifeos.workspace_chunk", "lifeos.workspace_commit"] as const;
export function pluginGrants(id: string): readonly string[] { return id === "dev.delta.media" ? MEDIA_API : id === "dev.delta.lifeos" ? LIFEOS_API : []; }
export async function pluginApiCall(id: string, capability: string, args: Record<string, unknown> = {}) {
  if (!pluginGrants(id).includes(capability)) throw Error('forbidden');
  const host = hostBridge(); if (host) return host.call({ capability, args });
  const token = readConnectionSettings().token;
  const response = await fetch('/apps/call', { method:'POST', credentials:'same-origin', headers:{ 'content-type':'application/json', ...(token ? {authorization:'Bearer '+token} : {}) }, body:JSON.stringify({ id, capability, args }) });
  const value = await response.json();
  if (!response.ok) throw Error(value.error || 'operation_failed');
  return value;
}
