import { useEffect, useRef, useState, type MouseEvent as RME } from "react";
import { useNavigate } from "react-router-dom";
import { WIcon } from "../workbench/Icon";
import { appCall } from "../sdk/apps";
import { useDock, useNowPlaying, mediaCommand, openAppManager } from "./state";
import { useRunningApps } from "./frames";
import { useLaunchers, useActiveLauncher, type Launcher } from "./launchers";
import { workspaceCommand } from "./workspaceBus";
import { s } from "./strings";
export function useOpenLauncher() {
  const navigate = useNavigate();
  return (l: Launcher) => {
    if (l.kind === "console") navigate("/");
    else if (l.kind === "app") navigate("/apps/" + encodeURIComponent(l.id));
    else {
      workspaceCommand({ op: "open", id: l.id });
      navigate("/workbench");
    }
  };
}
export async function removeApp(id: string) {
  if (!confirm(s("removeAppAsk"))) return;
  useRunningApps.getState().stop(id);
  await appCall("host.apps_remove", { id });
  window.dispatchEvent(new CustomEvent("delta:apps-changed", { detail: { id } }));
}
/** Context actions for one launcher; used by the dock menu and the manager cards. */
export function useLauncherActions() {
  const open = useOpenLauncher();
  const dock = useDock();
  const running = useRunningApps();
  return (l: Launcher, count: number) => {
    const pinned = !dock.unpinned.includes(l.key);
    const items: { icon: string; label: string; run: () => void; danger?: boolean; disabled?: boolean }[] = [
      { icon: "arrow-square-out", label: s("open"), run: () => open(l) },
      {
        icon: pinned ? "push-pin-slash" : "push-pin",
        label: s(pinned ? "unpin" : "pin"),
        run: () => dock.set({ unpinned: pinned ? [...dock.unpinned, l.key] : dock.unpinned.filter((k) => k !== l.key) }),
      },
    ];
    if (l.kind === "desk") {
      items.push(
        { icon: "pencil-simple", label: s("rename"), run: () => { const name = prompt(s("rename"), l.name); if (name?.trim()) workspaceCommand({ op: "rename", id: l.id, name: name.trim() }); } },
        { icon: "copy", label: s("duplicate"), run: () => workspaceCommand({ op: "duplicate", id: l.id }, s("copy")) },
        { icon: "trash", label: s("removeDesktop"), danger: true, disabled: count <= 1, run: () => { if (confirm(s("removeDesktopAsk"))) workspaceCommand({ op: "remove", id: l.id }); } },
      );
    }
    if (l.kind === "app") {
      if (running.running.includes(l.id)) items.push({ icon: "stop", label: s("stop"), run: () => running.stop(l.id) });
      items.push({ icon: "trash", label: s("removeApp"), danger: true, run: () => void removeApp(l.id).catch((e) => alert(e.message)) });
    }
    items.push({ icon: "sliders-horizontal", label: s("customizeDock"), run: () => openAppManager("dock") });
    return items;
  };
}
export function ContextMenu({ x, y, items, onClose }: { x: number; y: number; items: ReturnType<ReturnType<typeof useLauncherActions>>; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const down = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) onClose(); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    addEventListener("pointerdown", down, true);
    addEventListener("keydown", key);
    ref.current?.querySelector("button")?.focus();
    return () => { removeEventListener("pointerdown", down, true); removeEventListener("keydown", key); };
  }, [onClose]);
  const left = Math.min(x, innerWidth - 240), top = Math.min(y, innerHeight - items.length * 36 - 16);
  return (
    <div ref={ref} className="dx-menu" role="menu" style={{ left, top }}>
      {items.map((i) => (
        <button key={i.label} role="menuitem" disabled={i.disabled} className={i.danger ? "danger" : ""} onClick={() => { onClose(); i.run(); }}>
          <WIcon name={i.icon} size={16} />
          <span>{i.label}</span>
        </button>
      ))}
    </div>
  );
}
/** The one switcher outside every app. Position, size, order and labels are user-configurable. */
export function Dock({ live, peek = false }: { live: boolean; peek?: boolean }) {
  const dock = useDock();
  const { pinned, desktops } = useLaunchers(live);
  const active = useActiveLauncher(desktops.active);
  const open = useOpenLauncher();
  const actions = useLauncherActions();
  const running = useRunningApps((x) => x.running);
  const media = useNowPlaying((x) => x.states);
  const now = Object.entries(media).sort((a, b) => b[1].at - a[1].at)[0];
  const [menu, setMenu] = useState<{ x: number; y: number; l: Launcher } | null>(null);
  const press = useRef<number>(0);
  const context = (e: RME, l: Launcher) => {
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY, l });
  };
  const position = dock.position === "hidden" ? "bottom" : dock.position;
  const appsIn = (k: Launcher["kind"]) => pinned.filter((l) => l.kind === k);
  const groups = [appsIn("console").concat(appsIn("app")), appsIn("desk")].filter((g) => g.length);
  return (
    <nav className={"dx-dock" + (peek ? " peek" : "")} data-position={position} data-size={dock.size} data-labels={dock.labels} aria-label={s("dock")}>
      <div className="dx-dock-scroll">
        {groups.map((g, gi) => (
          <div className="dx-dock-group" key={gi}>
            {gi > 0 && <span className="dx-dock-sep" aria-hidden />}
            {g.map((l) => (
              <button
                key={l.key}
                className={"dx-launch" + (active === l.key ? " active" : "")}
                aria-current={active === l.key ? "page" : undefined}
                title={l.name}
                onClick={() => open(l)}
                onContextMenu={(e) => context(e, l)}
                onPointerDown={(e) => {
                  if (e.pointerType !== "touch") return;
                  const { clientX: x, clientY: y } = e;
                  press.current = window.setTimeout(() => setMenu({ x, y, l }), 520);
                }}
                onPointerUp={() => clearTimeout(press.current)}
                onPointerLeave={() => clearTimeout(press.current)}
              >
                <span className="dx-launch-icon" data-kind={l.kind}>
                  <WIcon name={l.icon} size={dock.size === "sm" ? 18 : dock.size === "lg" ? 24 : 20} />
                  {l.kind === "app" && running.includes(l.id) && <i className="dx-running" aria-label={s("running")} />}
                </span>
                <span className="dx-launch-label">{l.name}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
      <div className="dx-dock-tail">
        {dock.showPlayer && now && (
          <div className="dx-mini" title={now[1].title}>
            <button className="dx-mini-open" onClick={() => open({ key: "app:" + now[0], kind: "app", id: now[0], name: now[1].title, icon: "music-notes" })}>
              <WIcon name={now[1].playing ? "waveform" : "music-notes"} size={16} />
              <span className="dx-mini-text"><b>{now[1].title || s("nowPlaying")}</b>{now[1].subtitle && <small>{now[1].subtitle}</small>}</span>
            </button>
            <button className="dx-mini-btn" aria-label={now[1].playing ? s("pause") : s("play")} title={now[1].playing ? s("pause") : s("play")} onClick={() => mediaCommand(now[0], "toggle")}>
              <WIcon name={now[1].playing ? "pause" : "play"} size={16} />
            </button>
            {now[1].canNext && (
              <button className="dx-mini-btn" aria-label={s("next")} title={s("next")} onClick={() => mediaCommand(now[0], "next")}>
                <WIcon name="skip-forward" size={16} />
              </button>
            )}
          </div>
        )}
        <button className="dx-launch dx-tool" title={s("allApps")} onClick={() => openAppManager("apps")}>
          <span className="dx-launch-icon"><WIcon name="squares-four" size={20} /></span>
          <span className="dx-launch-label">{s("allApps")}</span>
        </button>
        <button className="dx-launch dx-tool" title={s("newDesktop")} onClick={() => openAppManager("desktops")}>
          <span className="dx-launch-icon"><WIcon name="plus" size={20} /></span>
          <span className="dx-launch-label">{s("newDesktopShort")}</span>
        </button>
      </div>
      {menu && <ContextMenu x={menu.x} y={menu.y} items={actions(menu.l, desktops.apps.length)} onClose={() => setMenu(null)} />}
    </nav>
  );
}
