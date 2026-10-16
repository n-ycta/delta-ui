import {
  defaultHome,
  uid,
  view,
  type Application,
  type Tree,
  type Workspace,
} from "./model";
import { t } from "./strings";
export const templateNames = ["console", "media", "studio", "canvas"] as const;
export function template(which: (typeof templateNames)[number]): Application {
  const base: Application = {
    home: { ...defaultHome },
    id: uid(),
    name: t(which),
    icon: {
      console: "squares-four",
      media: "music-notes",
      studio: "terminal-window",
      canvas: "selection-all",
    }[which],
    template: which,
    theme: {
      console: "graphite",
      media: "paper",
      studio: "midnight",
      canvas: "daylight",
    }[which] as Application["theme"],
    nav: "side",
    mobileNav: "bottom",
    chrome: true,
    brand: true,
    logo: true,
    brandName: "Delta",
    brandSymbol: "delta",
    gap: 16,
    radius: 8,
    accent: "#d65b2b",
    root: view("welcome", t("home"), "house"),
  };
  if (which === "console") {
    base.chrome = false;
    base.nav = "hidden";
    base.mobileNav = "hidden";
    base.root = view("system", t("console"), "squares-four", "/console");
  }
  if (which === "media") {
    base.nav = "bottom";
    base.accent = "#7155da";
    base.root = view("plugin", t("media"), "music-notes", "dev.delta.media");
  }
  if (which === "studio") {
    const n = view("notes", t("notes"), "note-pencil"),
      m = view("system", "MCP", "plugs-connected", "/mcp"),
      w = view("web", t("web"), "globe");
    const tabs: Tree = {
      id: uid(),
      title: t("studio"),
      icon: base.icon,
      type: "tabs",
      active: m.id,
      children: [m, w],
    };
    base.root = {
      id: uid(),
      title: t("studio"),
      icon: base.icon,
      type: "split",
      axis: "row",
      ratio: 0.5,
      children: [n, tabs],
    };
  }
  if (which === "canvas") {
    base.nav = "bottom";
    const n = view("notes", t("notes"), "note-pencil"),
      f = view("files", t("files"), "play-circle");
    base.root = {
      id: uid(),
      title: t("canvas"),
      icon: base.icon,
      type: "canvas",
      camera: { x: 0, y: 0, zoom: 1 },
      children: [n, f],
      rects: {
        [n.id]: { x: 32, y: 32, w: 440, h: 380 },
        [f.id]: { x: 504, y: 80, w: 480, h: 420 },
      },
    };
  }
  return base;
}
export function starters(): Workspace {
  const apps = templateNames.map(template);
  return { version: 1, active: apps[0].id, apps };
}
