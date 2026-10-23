import test from 'node:test';
import assert from 'node:assert/strict';
import { CHECK_EVERY_MS, dueForCheck, megabytes, normalizeUpdatePrefs, updateErrorKey } from '../src/host/updates';
import { tr } from '../src/i18n';

test('stored preferences are normalized and never trusted blindly', () => {
  assert.deepEqual(normalizeUpdatePrefs(undefined), { id: 'updates', enabled: true, channel: 'stable', lastCheck: 0, notified: '' });
  assert.equal(normalizeUpdatePrefs({ channel: 'nightly' }).channel, 'stable');
  assert.equal(normalizeUpdatePrefs({ channel: 'pre', enabled: false }).enabled, false);
  assert.equal(normalizeUpdatePrefs({ lastCheck: 'x', notified: 'v'.repeat(500) }).notified.length, 64);
  assert.equal(normalizeUpdatePrefs({ lastCheck: NaN }).lastCheck, 0);
});

test('automatic checks are rare and opt-out', () => {
  const p = normalizeUpdatePrefs({ lastCheck: 1_000_000 });
  assert.equal(dueForCheck(p, 1_000_000 + CHECK_EVERY_MS - 1), false);
  assert.equal(dueForCheck(p, 1_000_000 + CHECK_EVERY_MS), true);
  assert.equal(dueForCheck({ ...p, enabled: false }, Number.MAX_SAFE_INTEGER), false);
});

test('every host error code maps to a translated message', () => {
  for (const code of ['metered_consent_required', 'checksum_mismatch', 'untrusted_redirect', 'install_permission_required', 'github_http_403', { code: 'size_limit' }, 'nonsense', undefined]) {
    assert.ok(tr(updateErrorKey(code)).length > 0, String(code));
  }
  assert.equal(updateErrorKey('github_http_403'), 'nativeUpdate.err_http');
  assert.equal(updateErrorKey('<script>'), 'nativeUpdate.err_unknown');
});

test('sizes are shown in megabytes', () => {
  assert.equal(megabytes(0), '0.0');
  assert.equal(megabytes(5 * 1_048_576), '5.0');
  assert.equal(megabytes(120 * 1_048_576), '120');
  assert.equal(megabytes(-5), '0.0');
});
