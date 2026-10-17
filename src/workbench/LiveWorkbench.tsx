import "./embedded-layout.css";
import { appCall } from "../sdk/apps";
import { useQuery } from "../app/query";
import { readInstalledSurfaceApps } from "../sdk/surfaces";
import { language } from "../i18n";
import { useEffect, useMemo, useRef } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { useApi, ApiProvider } from "../app/ApiContext";
import { Shell } from "../layout/Shell";
import { ConsoleRoutes } from "../ConsoleRoutes";
import { AppSlot } from "../shell/frames";
import { Workbench } from "./Workbench";
import { nodeWorkspace } from "./remote";
import { t } from "./strings";
import { useNodes } from "../app/data";
import { useExistingDashboards } from "./ExistingWidget";
import { dashboardPlugins } from "../core/registry/dashboardIndex";
import type { PaletteItem } from "./Workbench";
import { LocalMedia } from "./LocalViews";
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
// App frames live in the root FrameHost (src/shell/frames.tsx) so they survive navigation.
export function LiveWorkbench({ demo = false }: { demo?: boolean }) {
  const api = useApi();
  const remote = useMemo(nodeWorkspace, []);
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
            <AppSlot id={n.target!.split("#")[0]} surface={n.target!.split("#")[1]} />
          )
        ) : (
          <SystemSurface
            theme={theme}
            appearance={appearance}
            route={n.type === "view" ? n.target || "/" : "/"}
          />
        )
      }
    />
  );
}
