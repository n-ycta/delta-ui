import {randomId} from '../sdk/random';
import { z } from "zod";
export type Theme = "paper" | "daylight" | "graphite" | "midnight";
export type Nav = "side" | "top" | "bottom" | "dock" | "hidden";
export type ViewKind =
  "welcome" | "notes" | "files" | "web" | "system" | "plugin" | "app";
export type Tree = {
  id: string;
  title: string;
  icon: string;
  hidden?: boolean;
} & (
  | { type: "view"; kind: ViewKind; target?: string }
  | { type: "split"; axis: "row" | "column"; ratio: number; children: Tree[] }
  | { type: "tabs"; active: string; children: Tree[] }
  | {
      type: "canvas";
      children: Tree[];
      camera: { x: number; y: number; zoom: number };
      rects: Record<string, { x: number; y: number; w: number; h: number }>;
    }
);
export const defaultHome = {
  date: true,
  greeting: true,
  description: true,
  summary: true,
  title: "",
  subtitle: "",
};
export interface Application {
  home: typeof defaultHome;
  id: string;
  name: string;
  icon: string;
  template: string;
  theme: Theme;
  nav: Nav;
  mobileNav: Nav;
  chrome: boolean;
  brand: boolean;
  logo: boolean;
  brandName: string;
  brandSymbol: string;
  root: Tree;
  gap: number;
  radius: number;
  accent: string;
}
export interface Workspace {
  version: 1;
  active: string;
  apps: Application[];
}
const text = z.string().max(120),
  id = z.string().regex(/^[\w-]{1,80}$/);
const nodeSchema: z.ZodType<Tree> = z.lazy(() =>
  z.intersection(
    z
      .object({
        id,
        title: text,
        icon: z.string().regex(/^[a-z0-9-]{1,70}$/),
        hidden: z.boolean().optional(),
      })
      .passthrough(),
    z.union([
      z
        .object({
          id,
          title: text,
          icon: text,
          hidden: z.boolean().optional(),
          type: z.literal("view"),
          kind: z.enum([
            "welcome",
            "notes",
            "files",
            "web",
            "system",
            "plugin",
            "app",
          ]),
          target: z.string().max(500).optional(),
        })
        .strict(),
      z
        .object({
          id,
          title: text,
          icon: text,
          hidden: z.boolean().optional(),
          type: z.literal("split"),
          axis: z.enum(["row", "column"]),
          ratio: z.number().min(0.15).max(0.85),
          children: z.array(nodeSchema).length(2),
        })
        .strict(),
      z
        .object({
          id,
          title: text,
          icon: text,
          hidden: z.boolean().optional(),
          type: z.literal("tabs"),
          active: id,
          children: z.array(nodeSchema).min(1).max(40),
        })
        .strict(),
      z
        .object({
          id,
          title: text,
          icon: text,
          hidden: z.boolean().optional(),
          type: z.literal("canvas"),
          children: z.array(nodeSchema).max(40),
          camera: z
            .object({
              x: z.number().min(-100000).max(100000),
              y: z.number().min(-100000).max(100000),
              zoom: z.number().min(0.25).max(2),
            })
            .strict(),
          rects: z.record(
            z
              .object({
                x: z.number().min(-100000).max(100000),
                y: z.number().min(-100000).max(100000),
                w: z.number().min(280).max(3000),
                h: z.number().min(240).max(3000),
              })
              .strict(),
          ),
        })
        .strict(),
    ]),
  ),
);
// Preflight before recursive schema parsing: imports must not exhaust the call stack.
export function validateWorkspace(value: unknown): Workspace {
  const raw = JSON.stringify(value);
  if (raw.length > 500000) throw Error("Layout exceeds 500 KB");
  const walk = (v: any, depth = 0): void => {
    if (depth > 16) throw Error("Maximum nesting: 16");
    if (v && typeof v === "object") {
      for (const [key, child] of Object.entries(v)) {
        if (["__proto__", "prototype", "constructor"].includes(key))
          throw Error("Unsafe property");
        if (child && typeof child === "object") walk(child, depth + 1);
      }
    }
  };
  walk(value);
  const app = z
    .object({
      home: z
        .object({
          date: z.boolean(),
          greeting: z.boolean(),
          description: z.boolean(),
          summary: z.boolean(),
          title: z.string().max(120),
          subtitle: z.string().max(500),
        })
        .strict()
        .default(defaultHome),
      id,
      name: text.min(1),
      icon: z.string().regex(/^[a-z0-9-]{1,70}$/),
      template: text,
      theme: z.enum(["paper", "daylight", "graphite", "midnight"]),
      nav: z.enum(["side", "top", "bottom", "dock", "hidden"]),
      mobileNav: z.enum(["side", "top", "bottom", "dock", "hidden"]),
      chrome: z.boolean().default(true),
      brand: z.boolean(),
      logo: z.boolean(),
      brandName: text.default("Delta"),
      brandSymbol: z
        .string()
        .regex(/^[a-z0-9-]{1,70}$/)
        .default("delta"),
      root: nodeSchema,
      gap: z.number().int().min(8).max(32),
      radius: z.number().int().min(0).max(24),
      accent: z.string().regex(/^#[0-9a-f]{6}$/i),
    })
    .strict();
  const result = z
    .object({
      version: z.literal(1),
      active: id,
      apps: z.array(app).min(1).max(32),
    })
    .strict()
    .parse(value) as Workspace;
  const appIds = new Set(result.apps.map((a) => a.id));
  if (appIds.size !== result.apps.length || !appIds.has(result.active))
    throw Error("Invalid application ID");
  let count = 0;
  const ids = new Set<string>();
  for (const a of result.apps)
    visit(a.root, (n) => {
      if (++count > 240 || ids.has(n.id))
        throw Error("Duplicate ID or too many components");
      ids.add(n.id);
      if (n.type === "tabs" && !n.children.some((c) => c.id === n.active))
        throw Error("Invalid active tab");
      if (n.type === "view" && n.kind === "app" && !appIds.has(n.target || ""))
        throw Error("Unknown application");
      if (
        n.type === "view" &&
        n.kind === "system" &&
        !/^\/(|console|fragments\/(?:heading|summary|dashboard)|plugins(?:\/[A-Za-z0-9_.%~-]{1,200})?|nodes(?:\/[A-Za-z0-9_.%~-]{1,200})?|events|dashboards(?:\/[A-Za-z0-9_.%~-]{1,200}(?:\/widgets\/[A-Za-z0-9_.%~-]{1,200})?)?|contracts|mcp|identity|access|settings)$/.test(
          n.target || "",
        )
      )
        throw Error("Unknown system view");
      if (
        n.type === "view" &&
        n.kind === "plugin" &&
        !/^[\w.-]{1,100}(?:#[a-z-]{1,32})?$/.test(n.target || "")
      )
        throw Error("Invalid plugin ID");
    });
  const done = new Set<string>();
  const follow = (appId: string, path: string[]) => {
    if (path.includes(appId)) throw Error("Application cycle");
    if (done.has(appId)) return;
    const a = result.apps.find((a) => a.id === appId)!;
    visit(a.root, (n) => {
      if (n.type === "view" && n.kind === "app")
        follow(n.target!, [...path, appId]);
    });
    done.add(appId);
  };
  result.apps.forEach((a) => follow(a.id, []));
  return result;
}
export const uid = () => randomId();
export function visit(tree: Tree, fn: (n: Tree) => void) {
  fn(tree);
  if (tree.type !== "view") tree.children.forEach((c) => visit(c, fn));
}
export function mapTree(tree: Tree, id: string, fn: (n: Tree) => Tree): Tree {
  if (tree.id === id) return fn(tree);
  return tree.type === "view"
    ? tree
    : { ...tree, children: tree.children.map((c) => mapTree(c, id, fn)) };
}
export function removeTree(tree: Tree, id: string): Tree {
  if (tree.type === "view") return tree;
  let children = tree.children
    .filter((c) => c.id !== id)
    .map((c) => removeTree(c, id));
  if (!children.length)
    return {
      id: tree.id,
      title: tree.title,
      icon: "note",
      type: "view",
      kind: "notes",
    };
  if (tree.type === "split" && children.length === 1) return children[0];
  if (tree.type === "tabs")
    return {
      ...tree,
      children,
      active: children.some((c) => c.id === tree.active)
        ? tree.active
        : children[0].id,
    };
  return { ...tree, children };
}
export function cloneTree(n: Tree): Tree {
  if (n.type === "view") return { ...n, id: uid() };
  const children = n.children.map(cloneTree);
  if (n.type === "canvas")
    return {
      ...n,
      id: uid(),
      children,
      rects: Object.fromEntries(
        children.map((c, i) => [
          c.id,
          n.rects[n.children[i].id] || {
            x: 24 + i * 32,
            y: 24 + i * 32,
            w: 480,
            h: 360,
          },
        ]),
      ),
    };
  return {
    ...n,
    id: uid(),
    children,
    ...(n.type === "tabs" ? { active: children[0].id } : {}),
  };
}
export const view = (
  kind: ViewKind,
  title: string,
  icon: string,
  target?: string,
): Tree => ({
  id: uid(),
  type: "view",
  kind,
  title,
  icon,
  ...(target ? { target } : {}),
});
