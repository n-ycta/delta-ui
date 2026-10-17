import { catalogSnapshot } from "./apps";
import { useRunningApps } from "./frames";
/**
 * Host-mediated intents between isolated apps (e.g. a YouTube source app asks the
 * player to enqueue a track). Policy comes from the reviewed catalog, never from the
 * sending frame: the sender must declare `send`, the receiver must declare `receive`.
 */
export type Deliver = (intent: string, payload: unknown, from: string) => void;
const receivers = new Map<string, Deliver>();
const pending = new Map<string, { intent: string; payload: unknown; from: string }[]>();
export function registerReceiver(app: string, deliver: Deliver) {
  receivers.set(app, deliver);
  const queued = pending.get(app) || [];
  pending.delete(app);
  for (const q of queued) deliver(q.intent, q.payload, q.from);
  return () => {
    if (receivers.get(app) === deliver) receivers.delete(app);
  };
}
/** Plain JSON only, ≤ 64 KB. */
export function sanitizePayload(v: unknown): unknown {
  const text = JSON.stringify(v ?? null);
  if (text.length > 65536) throw Error("payload_too_large");
  return JSON.parse(text);
}
export function routeIntent(from: string, intent: string, payload: unknown): "delivered" | "queued" | "forbidden" {
  const catalog = catalogSnapshot();
  const sender = catalog.find((a) => a.id === from);
  if (!sender?.intents.send.includes(intent)) return "forbidden";
  const target = catalog.find((a) => a.id !== from && a.intents.receive.includes(intent));
  if (!target) return "forbidden";
  let clean: unknown;
  try {
    clean = sanitizePayload(payload);
  } catch {
    return "forbidden";
  }
  const deliver = receivers.get(target.id);
  if (deliver) {
    deliver(intent, clean, from);
    return "delivered";
  }
  const q = pending.get(target.id) || [];
  if (q.length < 16) q.push({ intent, payload: clean, from });
  pending.set(target.id, q);
  useRunningApps.getState().start(target.id);
  return "queued";
}
