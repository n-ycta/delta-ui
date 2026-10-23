import type { NodeInfo } from '../contracts/node';
import { fmtDateTime } from './format';

/** used/total as 0..1, or null when the host does not report it (total 0, unavailable telemetry). */
export function nodeShare(n: NodeInfo, kind: 'memory' | 'disk'): number | null {
  if (n.telemetryUnavailable?.includes(kind)) return null;
  const used = kind === 'memory' ? n.memUsed : n.diskUsed;
  const total = kind === 'memory' ? n.memTotal : n.diskTotal;
  return total > 0 && Number.isFinite(used) ? used / total : null;
}

/** CPU load 0..100, or null when the host reports no CPU telemetry (mobile core, unreachable peer). */
export function nodeCpu(n: NodeInfo): number | null {
  return n.telemetryUnavailable?.includes('cpu') || !Number.isFinite(n.cpu) ? null : n.cpu;
}

/** Time of the last contact; null = never seen (not 1970). */
export function fmtSeen(ts: number | null | undefined): string {
  return ts == null ? '—' : fmtDateTime(ts);
}

/** One definition of "online / total" for every place that shows it. `reachable` = online + degraded. */
export function countNodes(nodes: readonly Pick<NodeInfo, 'status'>[] | undefined) {
  const list = nodes ?? [];
  const by = (s: NodeInfo['status']) => list.filter((n) => n.status === s).length;
  const online = by('online');
  const degraded = by('degraded');
  return { total: list.length, online, degraded, offline: by('offline'), connecting: by('connecting'), reachable: online + degraded };
}
