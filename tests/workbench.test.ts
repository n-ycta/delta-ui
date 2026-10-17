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
