import { useLocation } from "react-router-dom";
import { useDock } from "./state";
import { useInstalledApps, type InstalledApp } from "./apps";
import { useDesktops } from "./workspaceBus";
import { s } from "./strings";
export interface Launcher {
  key: string;
  kind: "console" | "app" | "desk";
  id: string;
  name: string;
  icon: string;
  app?: InstalledApp;
}
/** Every switchable thing, in the user's order. One list shared by the dock and the manager. */
export function useLaunchers(live: boolean) {
  const apps = useInstalledApps(live);
  const desktops = useDesktops();
  const dock = useDock();
  const all: Launcher[] = [
    { key: "console", kind: "console", id: "console", name: s("console"), icon: "terminal" },
    ...apps.map((a) => ({ key: "app:" + a.id, kind: "app" as const, id: a.id, name: a.name, icon: a.icon, app: a })),
    ...(dock.showDesktops ? desktops.apps.map((d) => ({ key: "desk:" + d.id, kind: "desk" as const, id: d.id, name: d.name, icon: d.icon })) : []),
  ];
  const rank = (k: string) => {
    const i = dock.order.indexOf(k);
    return i < 0 ? 1000 + all.findIndex((x) => x.key === k) : i;
  };
  const ordered = [...all].sort((a, b) => rank(a.key) - rank(b.key));
  return { all: ordered, pinned: ordered.filter((x) => !dock.unpinned.includes(x.key)), desktops };
}
export function useActiveLauncher(activeDesktop: string): string {
  const path = useLocation().pathname;
  if (path === "/workbench") return "desk:" + activeDesktop;
  if (path.startsWith("/apps/")) return "app:" + decodeURIComponent(path.slice(6));
  return "console";
}
