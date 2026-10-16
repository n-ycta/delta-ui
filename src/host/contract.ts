/** Host Bridge 1.0. JSON only; no paths, shell commands, credentials or arbitrary URLs. */
export const HOST_BRIDGE_VERSION = '1.0.0';
export const MAX_BRIDGE_BYTES = 64 * 1024;
export type HostKind = 'web' | 'desktop' | 'android';
export interface HostInfo { kind: HostKind; version: string; bridgeVersion: string; coreVersion?: string; uiVersion: string; features: string[]; nodeMode?: 'embedded' | 'attached'; lifecycle?: 'foreground' | 'tray' | 'external'; }
export interface CapabilityRequest { capability: string; args?: Record<string, unknown>; node?: string; }
export interface HostBridge { info(): Promise<HostInfo>; call(request: CapabilityRequest): Promise<unknown>; }
export function validateRequest(request: CapabilityRequest): void {
 if (!request || !/^[a-z][a-z0-9_-]*\.[a-zA-Z0-9_.-]+$/.test(request.capability) ||
   request.capability.length > 128 || (request.args !== undefined && (!request.args || Array.isArray(request.args) || typeof request.args !== 'object')) ||
   (request.node !== undefined && (typeof request.node !== 'string' || request.node.length > 128)) ||
   new TextEncoder().encode(JSON.stringify(request)).length > MAX_BRIDGE_BYTES) throw new Error('invalid_request');
}
export function compatibleBridge(version: string): boolean { return /^1\.\d+\.\d+$/.test(version); }
let bridge: HostBridge | undefined;
export function installHostBridge(value: HostBridge): void { if (bridge) throw Error('bridge_already_installed'); bridge=value; }
export function hostBridge(): HostBridge | undefined { return bridge; }
