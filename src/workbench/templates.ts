import {
  defaultHome,
  uid,
  view,
  type Application,
  type Tree,
  type Workspace,
} from "./model";
import { t } from "./strings";
/** Gallery order. "console" stays loadable for older layouts but is no longer a desktop: the Console is an app. */
export const templateNames = ["home", "studio", "canvas", "overview"] as const;
export type TemplateName = (typeof templateNames)[number] | "console" | "media";
export function template(which: TemplateName): Application {
  const base: Application = {
    home: { ...defaultHome },
    id: uid(),
    name: t(which),
    icon: {
      home: "house-line",
      console: "terminal",
      media: "vinyl-record",
      studio: "code",
      canvas: "selection-all",
      overview: "chart-donut",
    }[which],
    template: which,
    theme: "graphite",
    nav: "hidden",
    mobileNav: "hidden",
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
  if (which === "home") {
    const w = view("welcome", t("home"), "house-line"),
      n = view("notes", t("notes"), "note-pencil"),
      f = view("files", t("files"), "play-circle");
    base.root = {
      id: uid(),
      title: t("home"),
      icon: base.icon,
      type: "split",
      axis: "row",
      ratio: 0.62,
      children: [
        w,
        { id: uid(), title: t("tabs"), icon: "tabs", type: "tabs", active: n.id, children: [n, f] },
      ],
    };
  }
  if (which === "media") {
    const panels = [
      view('plugin', t('media'), 'play-circle', 'dev.delta.media#player'),
      view('plugin', t('media_playlists'), 'playlist', 'dev.delta.media#playlists'),
      view('plugin', t('media_queue'), 'queue', 'dev.delta.media#queue'),
      view('plugin', t('media_stats'), 'chart-bar', 'dev.delta.media#stats'),
      view('plugin', t('media_visualizer'), 'waveform', 'dev.delta.media#visualizer'),
    ];
    base.root = { id:uid(), title:t('media'), icon:base.icon, type:'canvas', camera:{x:0,y:0,zoom:1}, children:panels,
      rects:Object.fromEntries(panels.map((p,i)=>[p.id,{x:24+(i%2)*584,y:24+Math.floor(i/2)*380,w:560,h:356}])) };
  }
  if (which === "overview") {
    const h = view("system", t("summary"), "gauge", "/fragments/summary"),
      d = view("system", t("dashboard"), "chart-line", "/fragments/dashboard");
    base.root = { id: uid(), title: t("overview"), icon: base.icon, type: "split", axis: "column", ratio: 0.28, children: [h, d] };
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
      active: w.id,
      children: [m, view("system", t("events"), "pulse", "/events"), w],
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
  const apps = (["home", "studio", "canvas"] as const).map(template);
  return { version: 1, active: apps[0].id, apps };
}
