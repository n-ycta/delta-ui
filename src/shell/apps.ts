import { useEffect } from "react";
import { useQuery, queryClient } from "../app/query";
import { appCall } from "../sdk/apps";
import { readUiContributions } from "../sdk/surfaces";
import { language } from "../i18n";
export interface InstalledApp {
  id: string;
  name: string;
  version: string;
  icon: string;
  surfaces: { id: string; name: string; icon: string }[];
}
export interface CatalogApp {
  id: string;
  name: string;
  version: string;
  icon: string;
  description: string;
  intents: { send: string[]; receive: string[] };
}
const ID = /^[a-z][a-z0-9]*(?:\.[a-z0-9-]+)+$/;
const INTENT = /^[a-z]+(?:\.[a-z-]+){1,3}$/;
const ICON = /^[a-z0-9-]{1,70}$/;
const str = (v: unknown, max: number) => (typeof v === "string" && v.length <= max ? v : "");
function localized(v: unknown, max = 200): string {
  if (typeof v === "string") return v.slice(0, max);
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return str(o[language], max) || str(o.en, max);
  }
  return "";
}
/** Host responses are input: bounded parsing, unknown fields ignored. */
export function readInstalled(value: unknown): InstalledApp[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.slice(0, 128).flatMap((v: any) => {
    if (!v || !ID.test(str(v.id, 120)) || seen.has(v.id) || ["dev.delta.youtube","dev.delta.soundcloud","dev.delta.spotify","dev.delta.vector"].includes(v.id)) return [];
    seen.add(v.id);
    const ui = readUiContributions(v);
    const surfaces = (ui?.surfaces || []).map((x) => ({ id: x.id, name: x.name[language] || x.name.en, icon: x.icon }));
    const icon = ICON.test(str(v.icon, 70)) ? v.icon : surfaces[0]?.icon || "app-window";
    return [{ id: v.id, name: str(v.name, 120) || v.id, version: str(v.version, 80), icon, surfaces }];
  });
}
export function readCatalog(value: unknown): CatalogApp[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 256).flatMap((v: any) => {
    if (!v || !ID.test(str(v.id, 120))) return [];
    const list = (x: unknown) => (Array.isArray(x) ? x.slice(0, 16).filter((i): i is string => typeof i === "string" && INTENT.test(i)) : []);
    return [{
      id: v.id,
      name: str(v.name, 120) || v.id,
      version: str(v.version, 80),
      icon: ICON.test(str(v.icon, 70)) ? v.icon : "app-window",
      description: localized(v.description),
      intents: { send: list(v.intents?.send), receive: list(v.intents?.receive) },
    }];
  });
}
let catalogCache: CatalogApp[] = [];
export function catalogSnapshot() {
  return catalogCache;
}
export function useInstalledApps(enabled = true) {
  const q = useQuery("shell-apps", () => (enabled ? appCall("host.apps_list").then(readInstalled) : Promise.resolve([] as InstalledApp[])));
  return q.data || [];
}
export function useCatalog(enabled = true) {
  const q = useQuery("shell-catalog", () =>
    enabled ? appCall("host.apps_catalog").then((v) => (catalogCache = readCatalog(v))) : Promise.resolve([] as CatalogApp[]),
  );
  return q.data || [];
}
export function useAppsRefresh() {
  useEffect(() => {
    const f = () => {
      queryClient.invalidate("shell-apps");
      queryClient.invalidate("shell-catalog");
    };
    window.addEventListener("delta:apps-changed", f);
    return () => window.removeEventListener("delta:apps-changed", f);
  }, []);
}
