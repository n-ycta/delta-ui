import { useEffect, useState, type ReactNode } from "react";
import { useApi } from "../app/ApiContext";
import { SkinRoot } from "../theme/SkinRoot";
import { FrameHost } from "./frames";
import { Dock } from "./Dock";
import { AppManager } from "./AppManager";
import { useAppsRefresh, useCatalog } from "./apps";
import { useDock } from "./state";
import { s } from "./strings";
import "./shell.css";
/**
 * The one root above every route: global skin, persistent app frames, the dock and the
 * app manager. Console pages, desktops and apps render inside the stage.
 */
export function DeltaRoot({ children }: { children: ReactNode }) {
  const live = useApi().mode !== "mock";
  const dock = useDock();
  const [peek, setPeek] = useState(false);
  useAppsRefresh();
  useCatalog(live);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === "Space") {
        e.preventDefault();
        setPeek((v) => !v);
      } else if (e.key === "Escape") setPeek(false);
    };
    const close = () => setPeek(false);
    addEventListener("keydown", key);
    addEventListener("hashchange", close);
    return () => {
      removeEventListener("keydown", key);
      removeEventListener("hashchange", close);
    };
  }, []);
  const hidden = dock.position === "hidden";
  return (
    <FrameHost>
      <SkinRoot />
      <div className="dx-root" data-dock={dock.position} data-dock-size={dock.size} data-dock-labels={dock.labels}>
        {(!hidden || peek) && <Dock live={live} peek={hidden && peek} />}
        {hidden && !peek && <button className="dx-peek-handle" aria-label={s("dock")} title={s("dock")} onClick={() => setPeek(true)} />}
        <div className="dx-stage">{children}</div>
      </div>
      <AppManager live={live} />
    </FrameHost>
  );
}
