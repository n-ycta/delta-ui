import {hostBridge} from '../host/contract';
import type { CoreApi } from './types';
import { MockCoreAdapter } from './mock/MockCoreAdapter';
import { HttpCoreAdapter } from './http/HttpCoreAdapter';

export * from './types';

export interface ConnectionSettings { mode: 'mock' | 'http'; baseUrl: string; token?: string }

export const demoAvailable=import.meta.env?.DEV||import.meta.env?.VITE_ENABLE_DEMO==='true';
const KEY = 'delta.console.connection';

export function readConnectionSettings(): ConnectionSettings {
  if(hostBridge())return{mode:'http',baseUrl:'host://local'};
  const env = { mode: (import.meta.env.VITE_CORE_MODE as 'mock' | 'http') ?? 'http', baseUrl: (import.meta.env.VITE_CORE_URL as string) ?? '/api' };
  try { const settings={ ...env, ...JSON.parse(localStorage.getItem(KEY) ?? '{}'), token: sessionStorage.getItem(KEY + '.token') ?? undefined };if(!demoAvailable)settings.mode='http';return settings; } catch { return env; }
}
export function writeConnectionSettings(s: ConnectionSettings) {
  // Keep user API secrets out of persistent localStorage and configuration exports.
  const { token, ...settings } = s; localStorage.setItem(KEY, JSON.stringify(settings));
  if (token) sessionStorage.setItem(KEY + '.token', token); else sessionStorage.removeItem(KEY + '.token');
}

/** Adapter factory — the single place where the transport is chosen. */
export function createCoreApi(s: ConnectionSettings = readConnectionSettings()): CoreApi {
  const native=hostBridge();if(native)return new HttpCoreAdapter({baseUrl:'host://local',transport:(capability,args)=>native.call({capability,args})});
  return s.mode === 'http'||!demoAvailable ? new HttpCoreAdapter({ baseUrl: s.baseUrl, token: s.token }) : new MockCoreAdapter();
}
