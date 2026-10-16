import { validateWorkspace, type Workspace } from "./model";
import { starters } from "./templates";
const key = "delta.workbench.v1";
export function loadWorkspace(): { state: Workspace; recovered: boolean } {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { state: starters(), recovered: false };
    return { state: validateWorkspace(JSON.parse(raw)), recovered: false };
  } catch {
    return { state: starters(), recovered: true };
  }
}
export function persist(state: Workspace) {
  validateWorkspace(state);
  const value = JSON.stringify(state);
  const last = localStorage.getItem(key);
  if (last) localStorage.setItem(key + ".backup", last);
  localStorage.setItem(key, value);
}
export function download(
  name: string,
  value: string,
  type = "application/json",
) {
  const u = URL.createObjectURL(new Blob([value], { type }));
  const a = document.createElement("a");
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
}
export function loadBackup() {
  const raw = localStorage.getItem(key + ".backup");
  if (!raw) throw Error("No backup");
  return validateWorkspace(JSON.parse(raw));
}
