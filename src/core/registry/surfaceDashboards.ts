import type { DashboardConfig, PluginEntry } from "../contracts";
import type { InstalledApp } from "../../shell/apps";
import { dashboardPlugins } from "./dashboardIndex";
/** UI-first plugins need a usable generated dashboard even when they publish no numeric metrics. */
export function surfaceDashboardApps(
  plugins: PluginEntry[],
  apps: InstalledApp[],
) {
  const metricDashboards = new Set(
    dashboardPlugins(plugins).map((p) => p.manifest.id),
  );
  return apps.filter(
    (a) => a.surfaces.length > 0 && !metricDashboards.has(a.id),
  );
}
export function generateSurfaceDashboard(app: InstalledApp): DashboardConfig {
  const primary = app.surfaces[0];
  const now = Date.now();
  return {
    id: "gen_ui_" + app.id,
    name: app.name,
    icon: app.icon,
    origin: "generated",
    generatedFrom: app.id,
    range: "24h",
    refreshSec: 0,
    pinned: false,
    createdAt: now,
    updatedAt: now,
    widgets: [
      {
        id: "surface_" + app.id,
        type: "app",
        typeVersion: "1.0.0",
        title: primary?.name || app.name,
        source: { kind: "system", feed: "app" },
        display: { app: app.id, ...(primary ? { surface: primary.id } : {}) },
        layout: { x: 0, y: 0, w: 12, h: 22 },
      },
    ],
  };
}
