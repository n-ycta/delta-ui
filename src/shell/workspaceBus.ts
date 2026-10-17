import { useSyncExternalStore } from "react";
import { loadWorkspace, persist } from "../workbench/storage";
import { cloneTree, uid, type Application, type Workspace } from "../workbench/model";
import { template, type TemplateName } from "../workbench/templates";
export type WorkspaceCommand =
  | { op: "open"; id: string }
  | { op: "create"; template: TemplateName; name?: string }
  | { op: "rename"; id: string; name: string }
  | { op: "icon"; id: string; icon: string }
  | { op: "duplicate"; id: string }
  | { op: "remove"; id: string };
export const WORKSPACE_EVENT = "delta:workspace-command";
export const WORKSPACE_CHANGED = "delta:workspace-changed";
/** Pure desktop operations shared by the dock, the manager and the mounted workbench. */
export function applyCommand(state: Workspace, cmd: WorkspaceCommand, copyLabel = "copy"): Workspace {
  const find = (id: string) => state.apps.find((a) => a.id === id);
  switch (cmd.op) {
    case "open":
      return find(cmd.id) ? { ...state, active: cmd.id } : state;
    case "create": {
      if (state.apps.length >= 32) throw Error("32 desktops limit");
      const a = template(cmd.template);
      if (cmd.name) a.name = cmd.name.slice(0, 120);
      return { ...state, apps: [...state.apps, a], active: a.id };
    }
    case "rename":
      return { ...state, apps: state.apps.map((a) => (a.id === cmd.id ? { ...a, name: cmd.name.slice(0, 120) || a.name } : a)) };
    case "icon":
      return { ...state, apps: state.apps.map((a) => (a.id === cmd.id ? { ...a, icon: cmd.icon } : a)) };
    case "duplicate": {
      const src = find(cmd.id);
      if (!src || state.apps.length >= 32) return state;
      const copy: Application = { ...src, id: uid(), name: (src.name + " · " + copyLabel).slice(0, 120), root: cloneTree(src.root) };
      return { ...state, apps: [...state.apps, copy], active: copy.id };
    }
    case "remove": {
      if (state.apps.length <= 1 || !find(cmd.id)) return state;
      const apps = state.apps.filter((a) => a.id !== cmd.id);
      return { ...state, apps, active: state.active === cmd.id ? apps[0].id : state.active };
    }
  }
}
let mounted = 0;
export function markWorkbenchMounted() {
  mounted++;
  return () => {
    mounted--;
  };
}
export function workspaceCommand(cmd: WorkspaceCommand, copyLabel?: string) {
  if (mounted > 0) {
    window.dispatchEvent(new CustomEvent(WORKSPACE_EVENT, { detail: cmd }));
    return;
  }
  persist(applyCommand(loadWorkspace().state, cmd, copyLabel));
}
let cacheRaw: string | null | undefined, cacheValue: Workspace | undefined;
function snapshot(): Workspace {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem("delta.workbench.v1");
  } catch {}
  if (raw === cacheRaw && cacheValue) return cacheValue;
  cacheRaw = raw;
  cacheValue = loadWorkspace().state;
  return cacheValue;
}
function subscribe(fn: () => void) {
  window.addEventListener(WORKSPACE_CHANGED, fn);
  window.addEventListener("storage", fn);
  return () => {
    window.removeEventListener(WORKSPACE_CHANGED, fn);
    window.removeEventListener("storage", fn);
  };
}
export function useDesktops(): Workspace {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
