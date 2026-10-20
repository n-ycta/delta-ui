import {randomId} from './random';
/** App-side half of the grant-limited Plugin UI channel. No host token or IPC access. */
export interface AppContext {
  appId: string;
  /** Optional host-selected presentation surface; never an authority or grant. */
  surface?: string;
  language: "en" | "ru";
  theme: "light" | "dark";
  /** Global Delta skin. Apps should apply it (see applyThemeTokens) so the whole system looks as one. */
  tokens?: ThemeTokens;
}
/** Presentation-only design tokens of the user's global skin. Never a grant. */
export interface ThemeTokens {
  skin: "latte" | "gruvbox" | "mocha" | "tokyo";
  scheme: "light" | "dark";
  family: string;
  fonts: { sans: string; heading: string; mono: string };
  /** Fontsource packages the skin uses; apps bundle the ones they support. */
  fontKeys: string[];
  colors: Record<string, string>;
  series: string[];
  radius: { sm: number; md: number; lg: number };
  border: number;
  density: "compact" | "comfortable";
  type: { base: number; scale: number; lh: number; headingWeight: number; headingTracking: string; headingCase: string };
}
export interface MediaState {
  playing: boolean;
  title: string;
  subtitle?: string;
  position?: number;
  duration?: number;
  canNext?: boolean;
  canPrev?: boolean;
}
export type MediaCommand = "toggle" | "play" | "pause" | "next" | "prev";
export type IntentResult = "delivered" | "queued" | "forbidden";
const COLOR = /^(#[0-9a-f]{3,8}|rgba?\([0-9., %]+\)|hsla?\([0-9., %a-z]+\))$/i;
const FONT = /^[\w\s'",.-]{1,200}$/;
/**
 * Maps skin tokens to CSS custom properties on `root`:
 * --delta-<color>, --delta-series-N, --delta-font-sans|heading|mono, --delta-r-sm|md|lg, --delta-border.
 * Values are validated; anything unexpected is ignored.
 */
export function applyThemeTokens(tokens: ThemeTokens | undefined, root: HTMLElement = document.documentElement) {
  if (!tokens || typeof tokens !== "object") return;
  const set = (k: string, v: string) => root.style.setProperty("--delta-" + k, v);
  for (const [k, v] of Object.entries(tokens.colors || {}))
    if (/^[a-z0-9]{1,24}$/i.test(k) && typeof v === "string" && COLOR.test(v.trim()))
      set(k.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase()), v);
  (tokens.series || []).slice(0, 12).forEach((v, i) => typeof v === "string" && COLOR.test(v) && set("series-" + i, v));
  for (const k of ["sans", "heading", "mono"] as const) {
    const v = tokens.fonts?.[k];
    if (typeof v === "string" && FONT.test(v)) set("font-" + k, v);
  }
  for (const k of ["sm", "md", "lg"] as const) {
    const v = tokens.radius?.[k];
    if (typeof v === "number" && v >= 0 && v <= 40) set("r-" + k, v + "px");
  }
  if (typeof tokens.border === "number" && tokens.border >= 0 && tokens.border <= 4) set("border", tokens.border + "px");
  if(tokens.type && Number.isFinite(tokens.type.base) && tokens.type.base>=10 && tokens.type.base<=24 && Number.isFinite(tokens.type.scale) && tokens.type.scale>=1 && tokens.type.scale<=2){
    const b=tokens.type.base-(tokens.density==='compact'?.5:0),scale=tokens.type.scale;
    const sizes={xs:b-2.5,sm:b-1.5,md:b-.5,lg:b*1.1,xl:b*scale*1.15,'2xl':b*scale**2*1.2,num:b*scale**3*1.2};
    for(const [k,v]of Object.entries(sizes))set('fs-'+k,Math.round(v*10)/10+'px');
    if(Number.isFinite(tokens.type.lh)&&tokens.type.lh>=1&&tokens.type.lh<=2)set('lh',String(tokens.type.lh));
  }
  if (tokens.type && typeof tokens.type.headingWeight === "number") set("heading-weight", String(tokens.type.headingWeight));
  if (tokens.type && /^(none|uppercase)$/.test(tokens.type.headingCase)) set("heading-case", tokens.type.headingCase);
  if (tokens.type && /^-?[0-9.]+(em)?$/.test(tokens.type.headingTracking)) set("heading-tracking", tokens.type.headingTracking);
  if (["latte", "gruvbox", "mocha", "tokyo"].includes(tokens.skin)) root.dataset.deltaSkin = tokens.skin;
  if (["light", "dark"].includes(tokens.scheme)) root.dataset.theme = tokens.scheme;
  root.dataset.density = tokens.density === "compact" ? "compact" : "comfortable";
}
export function connectPlugin(
  parentOrigin: string,
  timeoutMs = 15000,
  callTimeoutMs = Math.max(timeoutMs, 35000),
): Promise<{
  context: AppContext;
  call(capability: string, args?: Record<string, unknown>): Promise<unknown>;
  /** Host changed theme, skin or surface. */
  onPresentation(fn: (context: AppContext) => void): () => void;
  /** Tell the shell what is playing (dock mini-player); null when idle. */
  reportMedia(state: MediaState | null): void;
  /** Play/pause/next/prev from the dock or desktops. */
  onMediaCommand(fn: (command: MediaCommand) => void): () => void;
  /** Ask the host to deliver an intent (e.g. "media.play") to the app the catalog allows. */
  sendIntent(intent: string, payload?: unknown): Promise<IntentResult>;
  onIntent(fn: (intent: string, payload: unknown, from: string) => void): () => void;
  close(): void;
}> {
  if (parent === window) return Promise.reject(Error("not_embedded"));
  const parentURL = new URL(parentOrigin);
  const origin =
    parentURL.origin === "null"
      ? parentURL.protocol + "//" + parentURL.host
      : parentURL.origin;
  if (!["http:", "https:", "tauri:"].includes(parentURL.protocol))
    return Promise.reject(Error("invalid_parent"));
  return new Promise((resolve, reject) => {
    const ready = () => parent.postMessage({ type: "delta:ready" }, origin);
    const retry = setInterval(ready, 300);
    const timer = setTimeout(() => {
      clearInterval(retry);
      window.removeEventListener("message", receive);
      reject(Error("host_timeout"));
    }, timeoutMs);
    function receive(e: MessageEvent) {
      if (
        e.source !== parent ||
        e.origin !== origin ||
        e.data?.type !== "delta:initialize" ||
        typeof e.data.channel !== "string" ||
        e.data.channel.length > 80
      )
        return;
      const context = e.data.context as AppContext;
      if (
        !context ||
        !["en", "ru"].includes(context.language) ||
        !["light", "dark"].includes(context.theme) ||
        typeof context.appId !== "string"
      )
        return;
      clearTimeout(timer);
      clearInterval(retry);
      window.removeEventListener("message", receive);
      const channel = e.data.channel;
      const pending = new Map<
        string,
        {
          resolve(v: unknown): void;
          reject(e: Error): void;
          timer: ReturnType<typeof setTimeout>;
        }
      >();
      let closed = false;
      const listeners = { presentation: new Set<(c: AppContext) => void>(), media: new Set<(c: MediaCommand) => void>(), intent: new Set<(i: string, p: unknown, f: string) => void>() };
      const intents = new Map<string, (r: IntentResult) => void>();
      const on = <T,>(set: Set<T>, fn: T) => (set.add(fn), () => void set.delete(fn));
      const post = (msg: Record<string, unknown>) => !closed && parent.postMessage({ ...msg, channel }, origin);
      const reply = (event: MessageEvent) => {
        if (
          event.source !== parent ||
          event.origin !== origin ||
          event.data?.channel !== channel
        )
          return;
        const d = event.data;
        if (d.type === "delta:presentation" && d.context && typeof d.context === "object") {
          Object.assign(context, d.context);
          for (const fn of listeners.presentation) fn(context);
          return;
        }
        if (d.type === "delta:media-command") {
          if (["toggle", "play", "pause", "next", "prev"].includes(d.command)) for (const fn of listeners.media) fn(d.command);
          return;
        }
        if (d.type === "delta:intent") {
          if (typeof d.intent === "string" && typeof d.from === "string") for (const fn of listeners.intent) fn(d.intent, d.payload, d.from);
          return;
        }
        if (d.type === "delta:intent-result") {
          intents.get(d.id)?.(["delivered", "queued"].includes(d.result) ? d.result : "forbidden");
          intents.delete(d.id);
          return;
        }
        const p = pending.get(event.data.id);
        if (!p) return;
        clearTimeout(p.timer);
        pending.delete(event.data.id);
        event.data.ok
          ? p.resolve(event.data.result)
          : p.reject(Error(event.data.error?.code || "operation_failed"));
      };
      window.addEventListener("message", reply);
      resolve({
        context,
        onPresentation: (fn) => on(listeners.presentation, fn),
        onMediaCommand: (fn) => on(listeners.media, fn),
        onIntent: (fn) => on(listeners.intent, fn),
        reportMedia(state) {
          post({ type: "delta:media-state", state });
        },
        sendIntent(intent, payload = null) {
          if (closed) return Promise.resolve("forbidden");
          return new Promise((resolve) => {
            const id = randomId();
            const timer = setTimeout(() => {
              intents.delete(id);
              resolve("forbidden");
            }, timeoutMs);
            intents.set(id, (r) => {
              clearTimeout(timer);
              resolve(r);
            });
            post({ type: "delta:intent", id, intent, payload });
          });
        },
        call(capability, args = {}) {
          if (closed) return Promise.reject(Error("channel_closed"));
          if (pending.size >= 4) return Promise.reject(Error("busy"));
          return new Promise((resolve, reject) => {
            const id = randomId();
            const timer = setTimeout(() => {
              pending.delete(id);
              reject(Error("host_timeout"));
            }, callTimeoutMs);
            pending.set(id, { resolve, reject, timer });
            parent.postMessage(
              { channel, id, request: { capability, args } },
              origin,
            );
          });
        },
        close() {
          closed = true;
          window.removeEventListener("message", reply);
          for (const p of pending.values()) {
            clearTimeout(p.timer);
            p.reject(Error("channel_closed"));
          }
          pending.clear();
        },
      });
    }
    window.addEventListener("message", receive);
    ready();
  });
}
