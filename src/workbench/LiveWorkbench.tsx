import { appCall } from "../sdk/apps";
import { queryClient, useQuery } from "../app/query";
import { readInstalledSurfaceApps } from "../sdk/surfaces";
import { language } from "../i18n";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { useApi, ApiProvider } from "../app/ApiContext";
import { Shell } from "../layout/Shell";
import { ConsoleRoutes } from "../ConsoleRoutes";
import { PluginSurface } from "../pages/plugins/PluginApp";
import { Workbench } from "./Workbench";
import { nodeWorkspace } from "./remote";
import { t } from "./strings";
import { useNodes } from "../app/data";
import { useExistingDashboards } from "./ExistingWidget";
import { dashboardPlugins } from "../core/registry/dashboardIndex";
import type { PaletteItem } from "./Workbench";
import { LocalMedia } from "./LocalViews";
import { WIcon } from "./Icon";
import { ThemeOverride, BrandOverride } from "../app/AppearanceContext";
import type { Application, Tree } from "./model";
function SystemSurface({
  route,
  theme,
  appearance,
}: {
  route: string;
  theme: "light" | "dark";
  appearance: Application;
}) {
  const api = useApi(),
    el = useRef<HTMLDivElement>(null),
    rootRef = useRef<ReturnType<typeof createRoot> | null>(null);
  const content = (
    <ApiProvider api={api}>
      <ThemeOverride.Provider value={theme}>
        <BrandOverride.Provider value={appearance}>
          <MemoryRouter initialEntries={[route === "/console" ? "/" : route]}>
            {route === "/console" ? (
              <Shell embedded>
                <ConsoleRoutes />
              </Shell>
            ) : (
              <ConsoleRoutes />
            )}
          </MemoryRouter>
        </BrandOverride.Provider>
      </ThemeOverride.Provider>
    </ApiProvider>
  );
  useEffect(() => {
    const container = document.createElement("div");
    container.style.height = "100%";
    el.current!.append(container);
    const root = createRoot(container);
    rootRef.current = root;
    root.render(content);
    return () => {
      rootRef.current = null;
      container.remove();
      queueMicrotask(() => root.unmount());
    };
  }, [api, route]);
  useEffect(() => {
    rootRef.current?.render(content);
  }, [
    theme,
    appearance.brand,
    appearance.logo,
    appearance.brandName,
    appearance.brandSymbol,
    appearance.home,
  ]);
  return <div className="wb-system-surface" ref={el} />;
}
interface Slot {
  surface?: string;
  id: string;
  el: HTMLDivElement;
  theme: "light" | "dark";
}
interface FramePosition {
  surface?: string;
  id: string;
  theme: "light" | "dark";
  visible: boolean;
  left: number;
  top: number;
  width: number;
  height: number;
  clip: string;
}
function PluginSlot({
  id,
  surface,
  theme,
  register,
  focus,
}: {
  id: string;
  surface?: string;
  theme: "light" | "dark";
  register: (slot: Slot) => () => void;
  focus: (el: HTMLDivElement) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(
    () => register({ id, surface, theme, el: ref.current! }),
    [id, surface, theme, register],
  );
  return (
    <div ref={ref} className="wb-plugin-slot">
      <div className="wb-empty">
        <WIcon name="app-window" size={32} />
        <p>{t("single")}</p>
        <button onClick={() => focus(ref.current!)}>{t("open")}</button>
      </div>
    </div>
  );
}
// Frames are never reparented. Moving an iframe DOM node reloads it on several hosts.
// One stable overlay per installed app follows its visible slot and remains mounted while hidden.
export function LiveWorkbench({ demo = false }: { demo?: boolean }) {
  const api = useApi();
  const [appRevisions, setAppRevisions] = useState<Record<string, number>>({});
  useEffect(() => {
    const changed = (e: Event) => {
      const id = (e as CustomEvent).detail?.id;
      if (typeof id !== "string") return;
      setAppRevisions((v) => ({ ...v, [id]: (v[id] || 0) + 1 }));
      queryClient.invalidate("workbench-app-surfaces");
    };
    window.addEventListener("delta:apps-changed", changed);
    return () => window.removeEventListener("delta:apps-changed", changed);
  }, []);
  const remote = useMemo(nodeWorkspace, []);
  const slots = useRef<Slot[]>([]),
    preferred = useRef<HTMLDivElement | null>(null);
  const [frames, setFrames] = useState<FramePosition[]>([]);
  const register = useCallback((slot: Slot) => {
    slots.current.push(slot);
    return () => {
      slots.current = slots.current.filter((s) => s !== slot);
    };
  }, []);
  const focus = useCallback((el: HTMLDivElement) => {
    preferred.current = el;
  }, []);
  const { dashboards, plugins, resolved } = useExistingDashboards(),
    nodes = useNodes();
  const installedApps = useQuery("workbench-app-surfaces", () =>
    demo ? Promise.resolve([]) : appCall("host.apps_list"),
  );
  const surfaces: PaletteItem[] = readInstalledSurfaceApps(
    installedApps.data,
  ).flatMap((app) =>
    app.ui.surfaces.map((s) => ({
      key: app.id + "-" + s.id,
      title: app.name + " / " + (s.name[language] || s.name.en),
      icon: s.icon,
      kind: "plugin" as const,
      target: app.id + "#" + s.id,
    })),
  );
  const palette: PaletteItem[] = [
    ...surfaces,
    ...(
      [
        "library",
        "audio",
        "video",
        "podcast",
        "audiobook",
        "radio",
        "playlists",
        "queue",
        "stats",
      ] as const
    ).map((k) => ({
      key: "media-" + k,
      title:
        "Media / " + t(("media_" + k) as any) + " · " + t("requiresPlugin"),
      icon: "music-notes",
      kind: "plugin" as const,
      target: "dev.delta.media#" + k,
    })),
    ...(["heading", "summary", "dashboard"] as const).map((k) => ({
      key: k,
      title: t(k),
      icon: "layout",
      kind: "system" as const,
      target: "/fragments/" + k,
    })),
    ...resolved.flatMap((d) =>
      d.widgets.map((w) => ({
        key: "widget-" + d.id + "-" + w.id,
        title: d.name + " / " + (w.title || w.type),
        icon: "chart-line",
        kind: "system" as const,
        target:
          "/dashboards/" +
          encodeURIComponent(d.id) +
          "/widgets/" +
          encodeURIComponent(w.id),
      })),
    ),
    ...(dashboards.data || [])
      .filter((d) => d.origin !== "home")
      .map((d) => ({
        key: "dashboard-" + d.id,
        title: d.name,
        icon: "chart-line",
        kind: "system" as const,
        target: "/dashboards/" + encodeURIComponent(d.id),
      })),
    ...dashboardPlugins(plugins.data || [])
      .filter(
        (p) =>
          !(dashboards.data || []).some(
            (d) => d.generatedFrom === p.manifest.id,
          ),
      )
      .map((p) => ({
        key: "generated-" + p.manifest.id,
        title: p.manifest.name,
        icon: "chart-line",
        kind: "system" as const,
        target: "/dashboards/gen_" + encodeURIComponent(p.manifest.id),
      })),
    ...(plugins.data || []).map((p) => ({
      key: "plugin-" + p.manifest.id,
      title: p.manifest.name,
      icon: "puzzle-piece",
      kind: "system" as const,
      target: "/plugins/" + encodeURIComponent(p.manifest.id),
    })),
    ...(nodes.data || []).map((n) => ({
      key: "node-" + n.id,
      title: n.name,
      icon: "hard-drives",
      kind: "system" as const,
      target: "/nodes/" + encodeURIComponent(n.id),
    })),
  ];
  useEffect(() => {
    let handle = 0,
      last = "",
      lastTime = 0;
    const measure = (time: number) => {
      if (time - lastTime < 50) {
        handle = requestAnimationFrame(measure);
        return;
      }
      lastTime = time;
      const ids = new Set([...slots.current.map((s) => s.id)]);
      setFrames((old) => {
        const all = new Set([...ids, ...old.map((f) => f.id)]);
        const next = [...all].map((id) => {
          const candidates = slots.current.filter(
            (s) =>
              s.id === id &&
              !s.el.closest("[hidden]") &&
              s.el.getClientRects().length,
          );
          const slot =
            candidates.find((s) => s.el === preferred.current) || candidates[0];
          if (!slot) {
            const prior = old.find((f) => f.id === id);
            return prior
              ? { ...prior, visible: false }
              : {
                  id,
                  theme: "dark" as const,
                  visible: false,
                  left: 0,
                  top: 0,
                  width: 0,
                  height: 0,
                  clip: "inset(0)",
                };
          }
          const r = slot.el.getBoundingClientRect();
          let left = Math.max(r.left, 0),
            right = Math.min(r.right, innerWidth),
            top = Math.max(r.top, 0),
            bottom = Math.min(r.bottom, innerHeight);
          let parent = slot.el.parentElement;
          while (parent) {
            const style = getComputedStyle(parent);
            if (
              /hidden|auto|scroll|clip/.test(
                style.overflow + style.overflowX + style.overflowY,
              )
            ) {
              const b = parent.getBoundingClientRect();
              left = Math.max(left, b.left);
              right = Math.min(right, b.right);
              top = Math.max(top, b.top);
              bottom = Math.min(bottom, b.bottom);
            }
            parent = parent.parentElement;
          }
          return {
            id,
            surface: slot.surface,
            theme: slot.theme,
            visible: right > left && bottom > top,
            left: r.left,
            top: r.top,
            width: r.width,
            height: r.height,
            clip: `inset(${Math.max(0, top - r.top)}px ${Math.max(0, r.right - right)}px ${Math.max(0, r.bottom - bottom)}px ${Math.max(0, left - r.left)}px)`,
          };
        });
        const serial = JSON.stringify(next);
        if (serial === last) return old;
        last = serial;
        return next;
      });
      handle = requestAnimationFrame(measure);
    };
    handle = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(handle);
  }, []);
  return (
    <Workbench
      live
      demo={demo || api.mode === "mock"}
      remote={demo ? undefined : remote}
      palette={palette}
      renderView={(n: Tree, theme, appearance) =>
        n.type === "view" && n.kind === "plugin" ? (
          demo ? (
            <LocalMedia />
          ) : (
            <PluginSlot
              id={n.target!.split("#")[0]}
              surface={n.target!.split("#")[1]}
              theme={theme}
              register={register}
              focus={focus}
            />
          )
        ) : (
          <SystemSurface
            theme={theme}
            appearance={appearance}
            route={n.type === "view" ? n.target || "/" : "/"}
          />
        )
      }
      overlay={
        <>
          {frames.map((f) => (
            <div
              key={f.id + ":" + (appRevisions[f.id] || 0)}
              hidden={!f.visible}
              className="wb-plugin-overlay wb-system-surface"
              style={{
                position: "fixed",
                left: f.left,
                top: f.top,
                width: f.width,
                height: f.height,
                clipPath: f.clip,
                zIndex: 15,
              }}
            >
              <PluginSurface
                id={f.id}
                surface={f.surface}
                inline
                themeOverride={f.theme}
              />
            </div>
          ))}
        </>
      }
    />
  );
}
