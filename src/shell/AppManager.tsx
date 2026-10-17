import { useEffect, useState, type JSX, type ReactNode } from "react";
import { WIcon } from "../workbench/Icon";
import { appCall } from "../sdk/apps";
import { templateNames, template, type TemplateName } from "../workbench/templates";
import type { Tree } from "../workbench/model";
import { usePrefs } from "../app/stores";
import { SkinPicker } from "../theme/SkinPicker";
import { useDock, type DockPosition } from "./state";
import { useCatalog, useInstalledApps } from "./apps";
import { useLaunchers, type Launcher } from "./launchers";
import { useRunningApps } from "./frames";
import { useLauncherActions, useOpenLauncher, ContextMenu } from "./Dock";
import { workspaceCommand } from "./workspaceBus";
import { s, type ShellWord } from "./strings";
type Tab = "apps" | "desktops" | "dock" | "theme";
function Preview({ tree }: { tree: Tree }) {
  const box = (n: Tree, depth: number): JSX.Element => {
    if (n.type === "view" || depth > 3) return <i key={n.id} className="dx-pv-view" data-kind={n.type === "view" ? n.kind : "group"} />;
    if (n.type === "split")
      return (
        <span key={n.id} className="dx-pv-split" style={{ flexDirection: n.axis === "row" ? "row" : "column" }}>
          <span style={{ flex: n.ratio }}>{box(n.children[0], depth + 1)}</span>
          <span style={{ flex: 1 - n.ratio }}>{box(n.children[1], depth + 1)}</span>
        </span>
      );
    if (n.type === "tabs") {
      const a = n.children.find((c) => c.id === n.active) || n.children[0];
      return <span key={n.id} className="dx-pv-tabs"><b />{a ? box(a, depth + 1) : null}</span>;
    }
    return (
      <span key={n.id} className="dx-pv-canvas">
        {n.children.slice(0, 4).map((c, i) => <i key={c.id} style={{ left: 8 + i * 14 + "%", top: 10 + i * 12 + "%" }} />)}
      </span>
    );
  };
  return <span className="dx-pv">{box(tree, 0)}</span>;
}
function Card({ l, meta, actions, children }: { l: Launcher; meta?: string; actions: ReturnType<ReturnType<typeof useLauncherActions>>; children?: ReactNode }) {
  const open = useOpenLauncher();
  const dock = useDock();
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const pinned = !dock.unpinned.includes(l.key);
  return (
    <div className="dx-card" onContextMenu={(e) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY }); }}>
      <button className="dx-card-main" onClick={() => open(l)}>
        {children || <span className="dx-card-icon" data-kind={l.kind}><WIcon name={l.icon} size={26} /></span>}
        <span className="dx-card-text"><strong>{l.name}</strong>{meta && <small>{meta}</small>}</span>
      </button>
      <div className="dx-card-actions">
        <button title={s(pinned ? "unpin" : "pin")} aria-label={s(pinned ? "unpin" : "pin")} className={pinned ? "on" : ""} onClick={() => dock.set({ unpinned: pinned ? [...dock.unpinned, l.key] : dock.unpinned.filter((k) => k !== l.key) })}>
          <WIcon name={pinned ? "push-pin" : "push-pin-slash"} size={16} />
        </button>
        <button title={s("more")} aria-label={s("more")} onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setMenu({ x: r.left, y: r.bottom + 4 }); }}>
          <WIcon name="dots-three" size={16} />
        </button>
      </div>
      {menu && <ContextMenu x={menu.x} y={menu.y} items={actions} onClose={() => setMenu(null)} />}
    </div>
  );
}
function AppsTab({ live }: { live: boolean }) {
  const { all, desktops } = useLaunchers(live);
  const installed = useInstalledApps(live);
  const catalog = useCatalog(live);
  const running = useRunningApps((x) => x.running);
  const actions = useLauncherActions();
  const [busy, setBusy] = useState(""), [error, setError] = useState("");
  const install = async (id: string, replace = false) => {
    setBusy(id);
    setError("");
    try {
      await appCall("host.apps_install", { id, replace });
      window.dispatchEvent(new CustomEvent("delta:apps-changed", { detail: { id } }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  };
  const apps = all.filter((l) => l.kind !== "desk");
  const available = catalog.filter((c) => !installed.some((i) => i.id === c.id));
  return (
    <>
      <p className="dx-hint">{s("appsHint")}</p>
      {error && <p className="dx-error" role="alert">{error}</p>}
      <div className="dx-cards">
        {apps.map((l) => {
          const cat = catalog.find((c) => c.id === l.id);
          const update = l.app && cat && cat.version && cat.version !== l.app.version;
          return (
            <Card key={l.key} l={l} actions={actions(l, desktops.apps.length)} meta={l.kind === "console" ? s("builtIn") : (running.includes(l.id) ? s("running") + " · " : "") + (l.app?.version || "")}>
              <span className="dx-card-icon" data-kind={l.kind}>
                <WIcon name={l.icon} size={26} />
                {update && <em className="dx-badge" title={s("update")}>{"↑"}</em>}
              </span>
            </Card>
          );
        })}
      </div>
      {installed.length > 0 && catalog.some((c) => installed.find((i) => i.id === c.id && i.version !== c.version)) && (
        <div className="dx-row-actions">
          {catalog.filter((c) => installed.find((i) => i.id === c.id && i.version !== c.version)).map((c) => (
            <button key={c.id} className="dx-btn" disabled={!!busy} onClick={() => confirm(s("updateAsk")) && void install(c.id, true)}>
              <WIcon name="arrow-circle-up" size={16} />{`${s("update")} ${c.name} → ${c.version}`}
            </button>
          ))}
        </div>
      )}
      <h3 className="dx-h3">{s("catalog")}</h3>
      {!live ? (
        <p className="dx-hint">{s("catalogDemo")}</p>
      ) : available.length ? (
        <div className="dx-cards">
          {available.map((c) => (
            <div className="dx-card dx-card-catalog" key={c.id}>
              <div className="dx-card-main">
                <span className="dx-card-icon"><WIcon name={c.icon} size={26} /></span>
                <span className="dx-card-text"><strong>{c.name}</strong><small>{c.description || c.version}</small></span>
              </div>
              <button className="dx-btn primary" disabled={!!busy} onClick={() => void install(c.id)}>
                <WIcon name="download-simple" size={16} />{busy === c.id ? s("installing") : s("install")}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="dx-hint">{s("catalogEmpty")}</p>
      )}
    </>
  );
}
function DesktopsTab({ live, onDone }: { live: boolean; onDone: () => void }) {
  const { all, desktops } = useLaunchers(live);
  const actions = useLauncherActions();
  const open = useOpenLauncher();
  const [name, setName] = useState("");
  const create = (k: TemplateName) => {
    workspaceCommand({ op: "create", template: k, name: name.trim() || undefined });
    const next = JSON.parse(localStorage.getItem("delta.workbench.v1") || "{}");
    open({ key: "desk", kind: "desk", id: next.active || "", name: "", icon: "" });
    onDone();
  };
  const list = desktops.apps.map((d) => all.find((l) => l.key === "desk:" + d.id) || { key: "desk:" + d.id, kind: "desk" as const, id: d.id, name: d.name, icon: d.icon });
  return (
    <>
      <p className="dx-hint">{s("desktopsHint")}</p>
      <div className="dx-cards dx-cards-wide">
        {list.map((l) => {
          const d = desktops.apps.find((x) => x.id === l.id)!;
          return (
            <Card key={l.key} l={l} actions={actions(l, desktops.apps.length)} meta={l.id === desktops.active ? s("current") : undefined}>
              <span className="dx-card-preview"><Preview tree={d.root} /><span className="dx-card-badge"><WIcon name={l.icon} size={16} /></span></span>
            </Card>
          );
        })}
      </div>
      <h3 className="dx-h3">{s("create")}</h3>
      <label className="dx-field">
        <span>{s("desktopName")}</span>
        <input value={name} maxLength={120} placeholder={s("desktopNamePlaceholder")} onChange={(e) => setName(e.target.value)} />
      </label>
      <div className="dx-templates">
        {templateNames.map((k) => {
          const tpl = template(k);
          return (
            <button key={k} className="dx-template" onClick={() => create(k)}>
              <span className="dx-card-preview"><Preview tree={tpl.root} /></span>
              <span className="dx-template-text">
                <strong><WIcon name={tpl.icon} size={16} /> {tpl.name}</strong>
                <small>{s(("tpl_" + k) as ShellWord)}</small>
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}
function DockTab({ live }: { live: boolean }) {
  const dock = useDock();
  const { all } = useLaunchers(live);
  const [drag, setDrag] = useState<string | null>(null);
  const keys = all.map((l) => l.key);
  const move = (key: string, to: number) => {
    const order = keys.filter((k) => k !== key);
    order.splice(Math.max(0, Math.min(order.length, to)), 0, key);
    dock.set({ order });
  };
  const positions: [DockPosition, string, ShellWord][] = [
    ["left", "sidebar-simple", "left"],
    ["bottom", "square-half-bottom", "bottom"],
    ["top", "rows", "top"],
    ["right", "sidebar-simple", "right"],
    ["hidden", "eye-slash", "hidden"],
  ];
  return (
    <>
      <p className="dx-hint">{s("dockHint")}</p>
      <div className="dx-settings">
        <div className="dx-field">
          <span>{s("position")}</span>
          <div className="dx-positions">
            {positions.map(([p, icon, label]) => (
              <button key={p} className={"dx-position" + (dock.position === p ? " active" : "")} data-pos={p} onClick={() => dock.set({ position: p })} aria-pressed={dock.position === p}>
                <span className="dx-position-pic"><i /></span>
                <span><WIcon name={icon} size={14} /> {s(label)}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="dx-field">
          <span>{s("size")}</span>
          <div className="dx-segment">
            {(["sm", "md", "lg"] as const).map((z) => (
              <button key={z} className={dock.size === z ? "active" : ""} onClick={() => dock.set({ size: z })}>{s(("size_" + z) as ShellWord)}</button>
            ))}
          </div>
        </div>
        <label className="dx-switch"><input type="checkbox" checked={dock.labels} onChange={(e) => dock.set({ labels: e.target.checked })} /><span>{s("labels")}</span></label>
        <label className="dx-switch"><input type="checkbox" checked={dock.showDesktops} onChange={(e) => dock.set({ showDesktops: e.target.checked })} /><span>{s("showDesktops")}</span></label>
        <label className="dx-switch"><input type="checkbox" checked={dock.showPlayer} onChange={(e) => dock.set({ showPlayer: e.target.checked })} /><span>{s("showPlayer")}</span></label>
        <p className="dx-hint">{s("hiddenHint")}</p>
      </div>
      <h3 className="dx-h3">{s("items")}</h3>
      <ol className="dx-order">
        {all.map((l, i) => {
          const pinned = !dock.unpinned.includes(l.key);
          return (
            <li
              key={l.key}
              draggable
              className={drag === l.key ? "dragging" : ""}
              onDragStart={(e) => { setDrag(l.key); e.dataTransfer.effectAllowed = "move"; }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); if (drag) move(drag, i); setDrag(null); }}
              onDragEnd={() => setDrag(null)}
            >
              <WIcon name="dots-six-vertical" size={16} />
              <WIcon name={l.icon} size={18} />
              <span className="grow">{l.name}<small>{s(l.kind === "desk" ? "desktop" : l.kind === "console" ? "builtIn" : "app")}</small></span>
              <button aria-label={s("up")} title={s("up")} disabled={i === 0} onClick={() => move(l.key, i - 1)}><WIcon name="arrow-up" size={14} /></button>
              <button aria-label={s("down")} title={s("down")} disabled={i === all.length - 1} onClick={() => move(l.key, i + 1)}><WIcon name="arrow-down" size={14} /></button>
              <label className="dx-switch small"><input type="checkbox" checked={pinned} onChange={() => dock.set({ unpinned: pinned ? [...dock.unpinned, l.key] : dock.unpinned.filter((k) => k !== l.key) })} /><span>{s("inDock")}</span></label>
            </li>
          );
        })}
      </ol>
      <button className="dx-btn" onClick={() => dock.set({ order: [], unpinned: [], position: "left", size: "md", labels: true, showDesktops: true, showPlayer: true })}>
        <WIcon name="arrow-counter-clockwise" size={16} />{s("resetDock")}
      </button>
    </>
  );
}
function ThemeTab() {
  const prefs = usePrefs();
  return (
    <>
      <SkinPicker />
      <div className="dx-field">
        <span>{s("density")}</span>
        <div className="dx-segment">
          {(["comfortable", "compact"] as const).map((d) => (
            <button key={d} className={prefs.density === d ? "active" : ""} onClick={() => prefs.set({ density: d })}>{s(d)}</button>
          ))}
        </div>
      </div>
    </>
  );
}
/** One place to open, install, remove and arrange apps and desktops, and to style the dock. */
export function AppManager({ live }: { live: boolean }) {
  const [tab, setTab] = useState<Tab | null>(null);
  useEffect(() => {
    const show = (e: Event) => {
      const d = (e as CustomEvent).detail;
      setTab(d === "catalog" ? "apps" : ["apps", "desktops", "dock", "theme"].includes(d) ? d : "apps");
    };
    window.addEventListener("delta:app-manager", show);
    return () => window.removeEventListener("delta:app-manager", show);
  }, []);
  useEffect(() => {
    if (!tab) return;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setTab(null); };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, [tab]);
  if (!tab) return null;
  const tabs: [Tab, string, ShellWord][] = [["apps", "squares-four", "apps"], ["desktops", "browsers", "desktops"], ["dock", "sidebar-simple", "dockTab"], ["theme", "palette", "theme"]];
  return (
    <div className="dx-overlay" onPointerDown={(e) => { if (e.target === e.currentTarget) setTab(null); }}>
      <section className="dx-modal" role="dialog" aria-modal="true" aria-label={s("manager")}>
        <header className="dx-modal-head">
          <nav className="dx-tabs" role="tablist">
            {tabs.map(([k, icon, label]) => (
              <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "active" : ""} onClick={() => setTab(k)}>
                <WIcon name={icon} size={16} />{s(label)}
              </button>
            ))}
          </nav>
          <button className="dx-close" aria-label={s("close")} title={s("close")} onClick={() => setTab(null)}><WIcon name="x" size={18} /></button>
        </header>
        <div className="dx-modal-body">
          {tab === "apps" && <AppsTab live={live} />}
          {tab === "desktops" && <DesktopsTab live={live} onDone={() => setTab(null)} />}
          {tab === "dock" && <DockTab live={live} />}
          {tab === "theme" && <ThemeTab />}
        </div>
      </section>
    </div>
  );
}
