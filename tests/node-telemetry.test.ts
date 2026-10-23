import test from 'node:test';
import assert from 'node:assert/strict';
import { countNodes, fmtSeen, nodeShare } from '../src/core/lib/nodes';
import { ago } from '../src/core/lib/format';

const base = { memUsed: 0, memTotal: 0, diskUsed: 0, diskTotal: 0 } as any;

test('memory and disk shares are null instead of NaN when the host reports no total', () => {
  assert.equal(nodeShare(base, 'memory'), null);
  assert.equal(nodeShare(base, 'disk'), null);
  assert.equal(nodeShare({ ...base, memUsed: 1, memTotal: 4 }, 'memory'), 0.25);
});

test('telemetryUnavailable wins over stale numbers', () => {
  assert.equal(nodeShare({ ...base, memUsed: 1, memTotal: 4, telemetryUnavailable: ['memory'] }, 'memory'), null);
});

test('a missing last contact is a dash, not 1970', () => {
  assert.equal(ago(null), '—');
  assert.equal(fmtSeen(null), '—');
  assert.notEqual(fmtSeen(Date.now()), '—');
});

test('one definition of online / total', () => {
  const c = countNodes([{ status: 'online' }, { status: 'degraded' }, { status: 'offline' }] as any);
  assert.deepEqual([c.online, c.degraded, c.offline, c.reachable, c.total], [1, 1, 1, 2, 3]);
  assert.equal(countNodes(undefined).total, 0);
});
