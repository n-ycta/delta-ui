import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { WIcon } from "./Icon";
import { t } from "./strings";
const KEY = "delta.workbench.launcher-hidden";
const EVENT = "delta:launcher-preference";
function read() {
  try {
    return localStorage.getItem(KEY) === "true";
  } catch {
    return false;
  }
}
function subscribe(fn: () => void) {
  window.addEventListener(EVENT, fn);
  window.addEventListener("storage", fn);
  return () => {
    window.removeEventListener(EVENT, fn);
    window.removeEventListener("storage", fn);
  };
}
export function useLauncherHidden() {
  const hidden = useSyncExternalStore(subscribe, read, () => false);
  return [
    hidden,
    (v: boolean) => {
      try {
        localStorage.setItem(KEY, String(v));
      } catch {}
      window.dispatchEvent(new Event(EVENT));
    },
  ] as const;
}
/** Host controls are transient and outside the user-editable tree. */
export function ControlLauncher({
  inline = false,
  demo = false,
  onApps,
  onEdit,
  onSettings,
}: {
  inline?: boolean;
  demo?: boolean;
  onApps: () => void;
  onEdit: () => void;
  onSettings: () => void;
}) {
  const [hidden] = useLauncherHidden(),
    [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (!root.current?.getClientRects().length) return;
      if (document.querySelector('.dx-root[data-dock="hidden"]')) return;
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === "Space") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    const outside = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", key);
    document.addEventListener("pointerdown", outside);
    return () => {
      window.removeEventListener("keydown", key);
      document.removeEventListener("pointerdown", outside);
    };
  }, []);
  const action = (fn: () => void) => {
    setOpen(false);
    fn();
  };
  return (
    <div
      ref={root}
      className={
        "wb-recovery-dock wb-control-launcher" +
        (inline ? " wb-console-actions" : "")
      }
      data-expanded={open}
      data-hidden={hidden}
    >
      {open && (
        <div
          className="wb-launcher-menu"
          role="group"
          aria-label={t("controls")}
        >
          {demo && <span className="wb-launcher-status">{t("demo")}</span>}
          <button
            type="button"
            title={t("apps")}
            aria-label={t("apps")}
            onClick={() => action(onApps)}
          >
            <WIcon name="squares-four" />
          </button>
          <button
            type="button"
            title={t("edit")}
            aria-label={t("edit")}
            onClick={() => action(onEdit)}
          >
            <WIcon name="sliders-horizontal" />
          </button>
          <button
            type="button"
            title={t("settings")}
            aria-label={t("settings")}
            onClick={() => action(onSettings)}
          >
            <WIcon name="gear-six" />
          </button>
        </div>
      )}
      {(!hidden || open) && (
        <button
          ref={trigger}
          type="button"
          data-launcher-toggle
          aria-label={t(open ? "collapseControls" : "controls")}
          title={t("controlsShortcut")}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <WIcon
            name={open ? "caret-right" : inline ? "dots-three-outline" : "caret-left"}
          />
        </button>
      )}
    </div>
  );
}
