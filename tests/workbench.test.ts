import { test } from "node:test";
import assert from "node:assert/strict";
import { starters, template } from "../src/workbench/templates";
import {
  cloneTree,
  mapTree,
  removeTree,
  validateWorkspace,
  view,
  visit,
} from "../src/workbench/model";
test("three valid distinct desktop starters; apps and Console are not desktops", () => {
  const s = starters();
  assert.equal(validateWorkspace(s).apps.length, 3);
  assert.deepEqual(
    s.apps.map((a) => a.root.type),
    ["split", "split", "canvas"],
  );
  const kinds: string[] = [];
  for (const a of s.apps) visit(a.root, (n) => { if (n.type === "view") kinds.push(n.kind); });
  assert(kinds.includes("welcome"));
});
test("tabs require active child", () => {
  const s = starters();
  s.apps[0].root = {
    id: "test-tabs",
    title: "Tabs",
    icon: "square",
    type: "tabs",
    active: "missing",
    children: [s.apps[0].root],
  };
  assert.throws(() => validateWorkspace(s));
});
test("unknown fields, script, invalid colors and system routes rejected", () => {
  for (const update of [
    { script: "alert(1)" },
    { accent: "url(javascript:alert(1))" },
    { root: { ...view("system", "x", "square", "/admin-secret") } },
  ]) {
    const s = starters();
    Object.assign(s.apps[0], update);
    assert.throws(() => validateWorkspace(s));
  }
});
test("duplicate stable node identities rejected", () => {
  const s = starters();
  s.apps[1].root.id = s.apps[0].root.id;
  assert.throws(() => validateWorkspace(s));
});
test("application self-reference and indirect cycles rejected", () => {
  const s = starters();
  s.apps[0].root = view("app", "x", "square", s.apps[1].id);
  s.apps[1].root = view("app", "y", "square", s.apps[0].id);
  assert.throws(() => validateWorkspace(s), /cycle/);
});
test("deep and oversized input rejected before recursive parsing", () => {
  let root: any = view("notes", "x", "note");
  for (let i = 0; i < 30; i++)
    root = { ...root, type: "tabs", children: [root] };
  const s = starters();
  s.apps[0].root = root;
  assert.throws(() => validateWorkspace(s), /nesting/);
  assert.throws(() => validateWorkspace({ x: "x".repeat(500001) }), /500 KB/);
});
test("clone remaps tabs and canvas rects without losing geometry", () => {
  for (const kind of ["console", "canvas"] as const) {
    const orig = template(kind).root,
      copy = cloneTree(orig);
    const ids = new Set<string>();
    visit(orig, (n) => ids.add(n.id));
    visit(copy, (n) => assert(!ids.has(n.id)));
    if (orig.type === "canvas" && copy.type === "canvas")
      assert.deepEqual(
        copy.rects[copy.children[0].id],
        orig.rects[orig.children[0].id],
      );
  }
});
test("removal collapses splits and repairs active tabs", () => {
  const s = template("studio");
  assert(s.root.type === "split");
  const n = removeTree(s.root, s.root.children[0].id);
  assert.equal(n.type, "tabs");
  if (n.type === "tabs") {
    const next = removeTree(n, n.active);
    assert(next.type === "tabs");
    assert.equal(next.active, next.children[0].id);
  }
});
test("targeted edits preserve unrelated nodes and do not alter permissions", () => {
  const studio = template("studio").root;
  assert(studio.type === "split");
  const root = studio.children[1];
  assert(root.type === "tabs");
  const other = root.children[1];
  const updated = mapTree(root, root.children[0].id, (n) => ({
    ...n,
    hidden: true,
  }));
  assert(updated.type === "tabs");
  assert.equal(updated.children[1], other);
  assert(!JSON.stringify(updated).includes("token"));
});

import { snapRect } from '../src/workbench/snapping';
test('canvas snaps edges and centers at screen-pixel threshold, resize and Alt bypass',()=>{
 const other={x:600,y:400,w:300,h:200};
 for(const zoom of [.5,1,2]){
  const input={x:600-280+6/zoom,y:90,w:280,h:200};
  const got=snapRect(input,[other],zoom);
  assert.equal(got.rect.x,320);assert(got.guides.some(g=>g.axis==='x'));
  assert.deepEqual(snapRect(input,[other],zoom,'',true),{rect:input,guides:[]});
  assert.equal(snapRect({x:0,y:0,w:600-6/zoom,h:200},[other],zoom,'e').rect.w,600);
 }
 assert.equal(snapRect({x:350,y:100,w:280,h:200},[other]).guides.length,0);
});

test('duplicate app desktop migration backs up raw data and preserves custom layouts',async()=>{
 const {loadWorkspace}=await import('../src/workbench/storage');
 const values=new Map<string,string>();
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>values.get(k)||null,setItem:(k:string,v:string)=>values.set(k,v)}});
 const original=starters();
 const consoleApp=template('console'),mediaApp=template('media');
 consoleApp.root=view('system','Console','terminal','/console');mediaApp.root=view('plugin','Media','play','dev.delta.media');
 const custom=template('media');custom.name='My custom panels';
 original.apps.push(consoleApp,mediaApp,custom);original.active=mediaApp.id;
 const raw=JSON.stringify(original);values.set('delta.workbench.v1',raw);values.set('delta.workbench.v2-apps','1');
 const result=loadWorkspace();assert.equal(result.recovered,false);assert(!result.state.apps.some(a=>a.id===consoleApp.id||a.id===mediaApp.id));assert(result.state.apps.some(a=>a.id===custom.id));assert.equal(values.get('delta.workbench.v1.before-app-duplicates-v4'),raw);assert.equal(loadWorkspace().state.apps.length,result.state.apps.length);
});
