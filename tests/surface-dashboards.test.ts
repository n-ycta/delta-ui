import test from "node:test";
import assert from "node:assert/strict";
import catalog from "../app-catalog.json";
import { readInstalled } from "../src/shell/apps";
import { DashboardConfig, type PluginEntry } from "../src/core/contracts";
import { dashboardCount } from "../src/core/registry/dashboardIndex";
import {
  generateSurfaceDashboard,
  surfaceDashboardApps,
} from "../src/core/registry/surfaceDashboards";
const app = readInstalled(catalog).find((a) => a.id === "dev.delta.lifeos")!;
test("UI-first LifeOS gets a valid, stable starter without inventing metrics or permissions", () => {
  assert.equal(app.surfaces.length, 13);
  const d = DashboardConfig.parse(generateSurfaceDashboard(app));
  assert.equal(d.id, "gen_ui_dev.delta.lifeos");
  assert.equal(d.generatedFrom, app.id);
  assert.equal(d.widgets.length, 1);
  assert.deepEqual(d.widgets[0].display, {
    app: app.id,
    surface: app.surfaces[0].id,
  });
  assert.deepEqual(d.widgets[0].source, { kind: "system", feed: "app" });
  assert.equal(d.refreshSec, 0);
  assert.equal(surfaceDashboardApps([], [app]).length, 1);
  assert.equal(dashboardCount([], [], [app]), 1);
  assert.equal(dashboardCount([d], [], [app]), 1);
  assert.equal(
    dashboardCount([{ ...d, id: "mine", origin: "user" }], [], [app]),
    2,
  );
  assert(!JSON.stringify(d).includes("grants"));
});
test("Metric dashboards keep precedence; absent UI surfaces do not create empty starters", () => {
  const plugin = {
    manifest: { id: app.id, metrics: [{}], views: [] },
    validation: { compatible: true },
    instance: { installedVersion: "0.1.0" },
  } as unknown as PluginEntry;
  assert.equal(surfaceDashboardApps([plugin], [app]).length, 0);
  assert.equal(dashboardCount([], [plugin], [app]), 1);
  assert.equal(surfaceDashboardApps([], [{ ...app, surfaces: [] }]).length, 0);
  assert.equal(dashboardCount([], [], [{ ...app, surfaces: [] }]), 0);
});
