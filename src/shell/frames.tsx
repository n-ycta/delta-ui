import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { create } from "zustand";
import { PluginSurface } from "../pages/plugins/PluginApp";
import { queryClient } from "../app/query";
import { WIcon } from "../workbench/Icon";
import { s } from "./strings";
/**
 * Application frames live above the router. Leaving a page, a desktop or the Console never
 * destroys a running app (music keeps playing); only an explicit "Stop" does.
 * Frames are never reparented: one fixed overlay per app follows its visible slot.
 */
interface Slot {
  id: string;
  surface?: string;
  el: HTMLDivElement;
}
interface FramePosition {
  key: string;
  id: string;
  surface?: string;
  visible: boolean;
  left: number;
  top: number;
  width: number;
  height: number;
  clip: string;
  scale: number;
}
interface Running {
  running: string[];
  start: (id: string) => void;
  stop: (id: string) => void;
}
export const useRunningApps = create<Running>((set) => ({
  running: [],
  start: (id) => set((s) => (s.running.includes(id) ? s : { running: [...s.running, id] })),
  stop: (id) => set((s) => ({ running: s.running.filter((x) => x !== id) })),
}));
interface FrameApi {
  register: (slot: Slot) => () => void;
  focus: (el: HTMLDivElement) => void;
}
const FrameContext = createContext<FrameApi | null>(null);
/** Desktops render some views in separate React roots; they reach the one host through this. */
let activeHost: FrameApi | null = null;
export function FrameHost({ children }: { children: ReactNode }) {
  const nodes = useRef(new Map<string,HTMLDivElement>());
  const slots = useRef<Slot[]>([]),
    preferred = useRef<HTMLDivElement | null>(null);
  const running = useRunningApps((s) => s.running);
  const [frames, setFrames] = useState<FramePosition[]>([]);
  const [revisions, setRevisions] = useState<Record<string, number>>({});
  useEffect(() => {
    const changed = (e: Event) => {
      const id = (e as CustomEvent).detail?.id;
      if (typeof id !== "string") return;
      setRevisions((v) => ({ ...v, [id]: (v[id] || 0) + 1 }));
      queryClient.invalidate("workbench-app-surfaces");
      queryClient.invalidate("shell-apps");
    };
    window.addEventListener("delta:apps-changed", changed);
    return () => window.removeEventListener("delta:apps-changed", changed);
  }, []);
  const register = useCallback((slot: Slot) => {
    slots.current.push(slot);
    useRunningApps.getState().start(slot.id);
    return () => {
      slots.current = slots.current.filter((x) => x !== slot);
    };
  }, []);
  const focus = useCallback((el: HTMLDivElement) => {
    preferred.current = el;
  }, []);
  const api = useRef<FrameApi>({ register, focus }).current;
  useEffect(() => {
    activeHost = api;
    return () => {
      if (activeHost === api) activeHost = null;
    };
  }, [api]);
  const runningRef = useRef(running);
  runningRef.current = running;
  useEffect(() => {
    let handle = 0,
      last = "",
      lastTime = 0;
    const measure = (time: number) => {
      handle = requestAnimationFrame(measure);
      if (time - lastTime < 12) return;
      lastTime = time;
      setFrames((old) => {
        const keys = new Map<string, { id: string; surface?: string }>();
        for (const id of runningRef.current) {
          const own = slots.current.filter(x => x.id === id);
          if (!own.length && !old.some(f=>f.id===id)) keys.set(id, { id });
          for (const x of own) keys.set(x.id + (x.surface ? '#' + x.surface : ''), { id:x.id, surface:x.surface });
        }
        for (const f of old) if (runningRef.current.includes(f.id) && !keys.has(f.key)) keys.set(f.key, {id:f.id,surface:f.surface});
        const next = [...keys].map(([key, {id, surface}]) => {
          const candidates = slots.current.filter(
            (x) => x.id === id && x.surface === surface && !x.el.closest("[hidden]") && x.el.getClientRects().length,
          );
          const slot = candidates.find((x) => x.el === preferred.current) || candidates[0];
          const prior = old.find((f) => f.key === key);
          if (!slot)
            return prior
              ? { ...prior, visible: false }
              : { key, id, surface, visible: false, left: 0, top: 0, width: 0, height: 0, clip: "inset(0)", scale: 1 };
          const r = slot.el.getBoundingClientRect();
          const scale = r.width / Math.max(1,slot.el.offsetWidth);
          const edge = slot.el.closest(".wb-window") ? 6*scale : 0;
          let left = Math.max(r.left+edge, 0),
            right = Math.min(r.right-edge, innerWidth),
            top = Math.max(r.top, 0),
            bottom = Math.min(r.bottom-edge, innerHeight);
          let parent = slot.el.parentElement;
          while (parent) {
            const st = getComputedStyle(parent);
            if (/hidden|auto|scroll|clip/.test(st.overflow + st.overflowX + st.overflowY)) {
              const b = parent.getBoundingClientRect();
              left = Math.max(left, b.left);
              right = Math.min(right, b.right);
              top = Math.max(top, b.top);
              bottom = Math.min(bottom, b.bottom);
            }
            parent = parent.parentElement;
          }
          return {
            key,
            id,
            surface: slot.surface,
            visible: right > left && bottom > top,
            left: r.left,
            top: r.top,
            width: slot.el.offsetWidth,
            height: slot.el.offsetHeight,
            scale,
            clip: `inset(${Math.max(0, (top - r.top)/scale)}px ${Math.max(0, (r.right - right)/scale)}px ${Math.max(0, (r.bottom - bottom)/scale)}px ${Math.max(0, (left - r.left)/scale)}px)`,
          };
        });
        for(const f of next){const el=nodes.current.get(f.key);if(el){
          Object.assign(el.style,{left:f.left+'px',top:f.top+'px',width:f.width+'px',height:f.height+'px',clipPath:f.clip,transform:`scale(${f.scale})`,transformOrigin:'top left'});
        }}
        const serial = JSON.stringify(next.map(({key,id,surface,visible})=>({key,id,surface,visible})));
        if (serial === last) return old;
        last = serial;
        return next;
      });
    };
    handle = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(handle);
  }, []);
  return (
    <FrameContext.Provider value={api}>
      {children}
      <div className="dx-frames" aria-hidden={frames.every((f) => !f.visible) || undefined}>
        {frames.map((f) => (
          <div
            key={f.key + ":" + (revisions[f.id] || 0)}
            ref={el=>{if(el)nodes.current.set(f.key,el);else nodes.current.delete(f.key);}}
            hidden={!f.visible}
            className="wb-plugin-overlay wb-system-surface dx-frame"
            style={{ position: "fixed", left: f.left, top: f.top, width: f.width, height: f.height, clipPath: f.clip, transform:`scale(${f.scale})`, transformOrigin:"top left", zIndex: 15 }}
          >
            <PluginSurface id={f.id} surface={f.surface} inline />
          </div>
        ))}
      </div>
    </FrameContext.Provider>
  );
}
/** A placeholder that shows the app's single shared frame while visible. */
export function AppSlot({ id, surface, className = "" }: { id: string; surface?: string; className?: string }) {
  const ctx = useContext(FrameContext) || activeHost;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => (ctx ? ctx.register({ id, surface, el: ref.current! }) : undefined), [ctx, id, surface]);
  if (!ctx)
    return (
      <div className={"wb-plugin-slot dx-slot " + className}>
        <PluginSurface id={id} surface={surface} inline />
      </div>
    );
  return (
    <div ref={ref} className={"wb-plugin-slot dx-slot " + className}>
      <div className="wb-empty">
        <WIcon name="app-window" size={32} />
        <p>{s("singleFrame")}</p>
        <button onClick={() => ctx?.focus(ref.current!)}>{s("showHere")}</button>
      </div>
    </div>
  );
}
