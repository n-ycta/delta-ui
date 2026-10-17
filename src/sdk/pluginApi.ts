import { hostBridge } from '../host/contract';
import { readConnectionSettings } from '../api';
/** Approved capabilities for Media's interface; never a wildcard or a raw core token. */
export const MEDIA_API = ['media.providers','media.search','media.resolve','media.library','media.play','media.pause','media.seek','media.next','media.previous','media.queue','media.playlists','media.settings','media.stats','media.session','media.sync'] as const;
export async function pluginApiCall(id: string, capability: string, args: Record<string, unknown> = {}) {
  if (id !== 'dev.delta.media' || !(MEDIA_API as readonly string[]).includes(capability)) throw Error('forbidden');
  const host = hostBridge(); if (host) return host.call({ capability, args });
  const token = readConnectionSettings().token;
  const response = await fetch('/apps/call', { method:'POST', credentials:'same-origin', headers:{ 'content-type':'application/json', ...(token ? {authorization:'Bearer '+token} : {}) }, body:JSON.stringify({ id, capability, args }) });
  const value = await response.json();
  if (!response.ok) throw Error(value.error || 'operation_failed');
  return value;
}
