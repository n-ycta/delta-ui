import { validateWorkspace, type Workspace } from "./model";
import { starters, template } from "./templates";
const MIGRATED = "delta.workbench.v2-apps";
/** v2: Console and Media are apps, not desktops. Drop untouched v1 starters once. */
function migrate(state: Workspace): Workspace {
  try {
    if(!localStorage.getItem('delta.workbench.media-panels-v3')){
      state={...state,apps:state.apps.map(a=>{
        if(a.template!=='media'||a.root.type!=='split'||a.root.children.length!==2)return a;
        const original=a.root.children.find(n=>n.type==='view'&&n.kind==='plugin'&&n.target==='dev.delta.media');
        const note=a.root.children.find(n=>n.type==='view'&&n.kind==='notes');
        if(!original||!note)return a;
        const root=template('media').root;
        if(root.type==='canvas'){root.children.push(note);root.rects[note.id]={x:24,y:1164,w:560,h:320};}
        return {...a,root};
      })};
      localStorage.setItem('delta.workbench.media-panels-v3','1');
    }
    if (localStorage.getItem(MIGRATED)) return state;
    localStorage.setItem(MIGRATED, "1");
  } catch {
    return state;
  }
  const starter = (a: Workspace["apps"][number]) =>
    a.root.type === "view" &&
    ((a.template === "console" && a.root.kind === "system" && a.root.target === "/console") ||
      (a.template === "media" && a.root.kind === "plugin" && a.root.target === "dev.delta.media"));
  let apps = state.apps.filter((a) => !starter(a));
  if (!apps.length) apps = [template("home")];
  if (!apps.some((a) => a.template === "home") && apps.length < 32) apps = [template("home"), ...apps];
  return validateWorkspace({ ...state, apps, active: apps.some((a) => a.id === state.active) ? state.active : apps[0].id });
}
const key = "delta.workbench.v1";
export function loadWorkspace(): { state: Workspace; recovered: boolean } {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      try {
        localStorage.setItem(MIGRATED, "1");
      } catch {}
      return { state: starters(), recovered: false };
    }
    const parsed=validateWorkspace(JSON.parse(raw));
    let next=migrate(parsed);
    if(!localStorage.getItem('delta.workbench.app-duplicates-v4')) {
      const apps=next.apps.filter(a=>!(a.root.type==='view'&&((a.root.kind==='system'&&a.root.target==='/console')||(a.root.kind==='plugin'&&a.root.target==='dev.delta.media'))));
      if(apps.length!==next.apps.length){
        const kept=apps.length?apps:[template('home')];
        next=validateWorkspace({...next,apps:kept,active:kept.some(a=>a.id===next.active)?next.active:kept[0].id});
      }
      localStorage.setItem(key+'.before-app-duplicates-v4',raw);
      // Persist before recording migration completion; never lose customized layouts.
      localStorage.setItem(key,JSON.stringify(next));
      localStorage.setItem('delta.workbench.app-duplicates-v4','1');
    }
    return { state: next, recovered: false };
  } catch {
    return { state: starters(), recovered: true };
  }
}
export function persist(state: Workspace) {
  validateWorkspace(state);
  const value = JSON.stringify(state);
  const last = localStorage.getItem(key);
  if (last === value) return;
  if (last) localStorage.setItem(key + ".backup", last);
  localStorage.setItem(key, value);
  window.dispatchEvent(new Event("delta:workspace-changed"));
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
