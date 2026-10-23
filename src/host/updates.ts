/** Preferences and message mapping for the Android in-app updater. Security decisions live in the native host. */
export const CHECK_EVERY_MS = 6 * 3_600_000;

export interface UpdatePrefs { id: 'updates'; enabled: boolean; channel: 'stable' | 'pre'; lastCheck: number; notified: string }

export const defaultUpdatePrefs: UpdatePrefs = { id: 'updates', enabled: true, channel: 'stable', lastCheck: 0, notified: '' };

export function normalizeUpdatePrefs(value: unknown): UpdatePrefs {
  const v = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  return {
    id: 'updates',
    enabled: typeof v.enabled === 'boolean' ? v.enabled : defaultUpdatePrefs.enabled,
    channel: v.channel === 'pre' ? 'pre' : 'stable',
    lastCheck: typeof v.lastCheck === 'number' && Number.isFinite(v.lastCheck) ? v.lastCheck : 0,
    notified: typeof v.notified === 'string' ? v.notified.slice(0, 64) : '',
  };
}

/** Automatic checks are rare (anonymous GitHub API allows 60 requests an hour) and only when switched on. */
export function dueForCheck(p: UpdatePrefs, now: number): boolean {
  return p.enabled && now - p.lastCheck >= CHECK_EVERY_MS;
}

export const KNOWN = new Set(['metered_consent_required', 'not_newer', 'size_limit', 'checksum_mismatch', 'untrusted_redirect', 'update_busy',
  'update_not_ready', 'version_not_offered', 'network_failed', 'install_permission_required', 'unsupported', 'storage_failed', 'checksum_missing',
  'install_failed', 'update_invalid', 'invalid_channel', 'response_too_large', 'bad_release_json', 'client_failed', 'update_env_invalid', 'update_failed']);

/** i18n key for a host error code; unknown codes never leak raw text into the UI. */
export function updateErrorKey(code: unknown): string {
  const c = typeof code === 'string' ? code : (code as { code?: string } | undefined)?.code ?? '';
  if (KNOWN.has(c)) return `nativeUpdate.err_${c}`;
  if (/^(github|download)_http_\d{3}$/.test(c)) return 'nativeUpdate.err_http';
  return 'nativeUpdate.err_unknown';
}

export function megabytes(bytes: number): string {
  return (Math.max(0, bytes) / 1_048_576).toFixed(bytes >= 10_485_760 ? 0 : 1);
}
