import { create } from "zustand";
import { persist } from "zustand/middleware";
export type DockPosition = "left" | "bottom" | "top" | "right" | "hidden";
export type DockSize = "sm" | "md" | "lg";
interface DockPrefs {
  position: DockPosition;
  labels: boolean;
  size: DockSize;
  /** Ordered launcher keys: "console", "app:<id>", "desk:<id>". Unknown keys are appended. */
  order: string[];
  /** Keys deliberately removed from the dock (still available in the manager). */
  unpinned: string[];
  showDesktops: boolean;
  showPlayer: boolean;
  set: (p: Partial<Omit<DockPrefs, "set">>) => void;
}
export const useDock = create<DockPrefs>()(
  persist(
    (set) => ({
      position: "left",
      labels: true,
      size: "md",
      order: [],
      unpinned: [],
      showDesktops: true,
      showPlayer: true,
      set: (p) => set(p),
    }),
    { name: "delta.shell.dock", version: 1 },
  ),
);
export interface MediaState {
  playing: boolean;
  title: string;
  subtitle: string;
  position?: number;
  duration?: number;
  canNext: boolean;
  canPrev: boolean;
}
type Command = "toggle" | "play" | "pause" | "next" | "prev";
interface NowPlaying {
  states: Record<string, MediaState & { at: number }>;
  report: (app: string, state: MediaState | null) => void;
}
export const useNowPlaying = create<NowPlaying>((set) => ({
  states: {},
  report: (app, state) =>
    set((s) => {
      const states = { ...s.states };
      if (state) states[app] = { ...state, at: Date.now() };
      else delete states[app];
      return { states };
    }),
}));
const commanders = new Map<string, (c: Command) => void>();
export function registerMediaCommander(app: string, fn: (c: Command) => void) {
  commanders.set(app, fn);
  return () => {
    if (commanders.get(app) === fn) commanders.delete(app);
  };
}
export function mediaCommand(app: string, c: Command) {
  commanders.get(app)?.(c);
}
/** Coerces untrusted plugin media metadata into bounded display text. */
export function readMediaState(v: unknown): MediaState | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const text = (x: unknown) => (typeof x === "string" ? x.replace(/[\u0000-\u001f]/g, "").slice(0, 160) : "");
  const num = (x: unknown) => (typeof x === "number" && Number.isFinite(x) && x >= 0 && x < 1e7 ? x : undefined);
  return {
    playing: o.playing === true,
    title: text(o.title),
    subtitle: text(o.subtitle),
    position: num(o.position),
    duration: num(o.duration),
    canNext: o.canNext === true,
    canPrev: o.canPrev === true,
  };
}
export function openAppManager(tab: "apps" | "desktops" | "dock" | "theme" | "catalog" = "apps") {
  window.dispatchEvent(new CustomEvent("delta:app-manager", { detail: tab }));
}
