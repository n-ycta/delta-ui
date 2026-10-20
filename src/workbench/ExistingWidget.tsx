import {randomId} from '../sdk/random';
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useDashboards, usePlugins } from "../app/data";
import {
  generatePluginDashboard,
  mergeGeneratedDashboard,
} from "../core/registry/autodash";
import { widgetRegistry } from "../widgets/registry";
import { WidgetFrame } from "../dashboards/WidgetFrame";
import { WidgetEditor } from "../dashboards/WidgetEditor";
import { useDashboardActions } from "../dashboards/useDashboardActions";
import { useCan } from "../app/stores";
import type { WidgetConfig } from "../core/contracts";
import { t } from "./strings";
export function useExistingDashboards() {
  const dashboards = useDashboards(),
    plugins = usePlugins();
  const resolved = useMemo(() => {
    const result = [...(dashboards.data || [])];
    for (const p of plugins.data || []) {
      if (!p.instance.installedVersion || !p.validation.compatible) continue;
      const existing = result.find((d) => d.generatedFrom === p.manifest.id);
      const fresh = generatePluginDashboard(p, widgetRegistry);
      if (existing) {
        result[result.indexOf(existing)] = mergeGeneratedDashboard(
          existing,
          fresh,
        );
      } else if (fresh.widgets.length) result.push(fresh);
    }
    return result;
  }, [dashboards.data, plugins.data]);
  return { dashboards, plugins, resolved };
}
/** References the existing widget; queries, permissions and editing remain owned by the dashboard. */
export function ExistingWidget() {
  const { id = "", widgetId = "" } = useParams(),
    { resolved, plugins } = useExistingDashboards(),
    { save } = useDashboardActions(),
    can = useCan("dashboards.write");
  const d = resolved.find((d) => d.id === id),
    w = d?.widgets.find((w) => w.id === widgetId),
    [editing, setEditing] = useState(false);
  if (!d || !w)
    return (
      <div className="wb-empty">
        <p>{t("unsupported")}</p>
        <Link to={"/dashboards/" + encodeURIComponent(id)}>{t("open")}</Link>
      </div>
    );
  const update = async (next: WidgetConfig) => {
    if (!can) return;
    await save({
      ...d,
      widgets: d.widgets.map((v) => (v.id === w.id ? next : v)),
      updatedAt: Date.now(),
    });
    setEditing(false);
  };
  const change = (patch: Partial<WidgetConfig>) =>
    void update({ ...w, ...patch });
  const duplicate = () => {
    if (!can) return;
    const copy = {
      ...w,
      id: randomId(),
      layout: {
        ...w.layout,
        y: Math.max(...d.widgets.map((v) => v.layout.y + v.layout.h), 0),
      },
    };
    void save({ ...d, widgets: [...d.widgets, copy], updatedAt: Date.now() });
  };
  return (
    <div className="wb-existing-widget">
      <div className="wb-linked-widget">
        <Link to={"/dashboards/" + encodeURIComponent(d.id)}>{d.name}</Link>
        <span>{t("linked")}</span>
      </div>
      <WidgetFrame
        config={w}
        plugins={plugins.data}
        range={d.range}
        refreshSec={d.refreshSec}
        editing={false}
        onEdit={() => setEditing(true)}
        onRemove={() => {
          if (can && confirm(t("removeWidgetAsk")))
            void save({
              ...d,
              widgets: d.widgets.filter((v) => v.id !== w.id),
            });
        }}
        onDuplicate={duplicate}
        onDisplay={(patch) => change({ display: { ...w.display, ...patch } })}
        onReplaceType={(type) => {
          const def = widgetRegistry.get(type);
          if (def) change({ type, typeVersion: def.version });
        }}
      />
      <WidgetEditor
        open={editing && can}
        initial={w}
        plugins={plugins.data}
        range={d.range}
        onClose={() => setEditing(false)}
        onSave={(next) => {
          void update(next);
        }}
      />
    </div>
  );
}
