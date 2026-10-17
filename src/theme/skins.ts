/**
 * Delta skins — one global appearance for the Console, desktops and every plugin.
 * A skin is a complete design language: palette, typography, geometry and density.
 * Palettes follow well-known open themes (Catppuccin, Gruvbox, Tokyo Night).
 */
export type SkinId = "latte" | "gruvbox" | "mocha" | "tokyo";
export type Scheme = "light" | "dark";
export interface Skin {
  id: SkinId;
  scheme: Scheme;
  /** Visual family shown in pickers (proper names, not translated). */
  family: string;
  fonts: { sans: string; heading: string; mono: string };
  /** Font packages a plugin should bundle or fall back from. */
  fontKeys: string[];
  palette: {
    bg: string; surface: string; surface2: string; sunken: string; hover: string; selected: string;
    ink: string; ink2: string; muted: string; faint: string; rule: string; ruleStrong: string;
    accent: string; accentWeak: string; accentInk: string; accent2: string;
    ok: string; okWeak: string; warn: string; warnWeak: string; err: string; errWeak: string; crit: string;
    info: string; infoWeak: string; off: string; overlay: string;
  };
  series: string[];
  geometry: { rSm: number; rMd: number; rLg: number; border: number; shadow: string };
  type: { base: number; scale: number; headingWeight: number; headingTracking: string; headingCase: "none" | "uppercase"; lh: number };
  density: { row: number; ctl: number };
  /** Desktop wallpaper: subtle and theme-native. */
  wallpaper: string;
}
const sans = (f: string) => `'${f}', system-ui, -apple-system, 'Segoe UI', sans-serif`;
const mono = (f: string) => `'${f}', ui-monospace, 'SFMono-Regular', Menlo, monospace`;
export const SKINS: Record<SkinId, Skin> = {
  latte: {
    id: "latte", scheme: "light", family: "Catppuccin Latte",
    fonts: { sans: sans("Manrope"), heading: sans("Manrope"), mono: mono("JetBrains Mono") },
    fontKeys: ["manrope", "jetbrains-mono"],
    palette: {
      bg: "#eff1f5", surface: "#ffffff", surface2: "#f6f7fa", sunken: "#e6e9ef", hover: "#e6e9ef", selected: "#dce0e8",
      ink: "#4c4f69", ink2: "#5c5f77", muted: "#6c6f85", faint: "#9ca0b0", rule: "#dce0e8", ruleStrong: "#ccd0da",
      accent: "#8839ef", accentWeak: "#ece0fd", accentInk: "#ffffff", accent2: "#ea76cb",
      ok: "#40a02b", okWeak: "#dff1da", warn: "#df8e1d", warnWeak: "#fbecd5", err: "#d20f39", errWeak: "#fad6dd", crit: "#a10a2b",
      info: "#1e66f5", infoWeak: "#dbe6fe", off: "#9ca0b0", overlay: "rgba(76,79,105,.28)",
    },
    series: ["#8839ef", "#1e66f5", "#fe640b", "#40a02b", "#ea76cb", "#179299", "#df8e1d", "#d20f39"],
    geometry: { rSm: 8, rMd: 12, rLg: 18, border: 1, shadow: "0 1px 2px rgba(76,79,105,.06), 0 8px 24px -12px rgba(76,79,105,.18)" },
    type: { base: 13.5, scale: 1.2, headingWeight: 800, headingTracking: "-0.02em", headingCase: "none", lh: 1.5 },
    density: { row: 36, ctl: 32 },
    wallpaper: "radial-gradient(1200px 600px at 10% -10%, #ece0fd 0%, transparent 60%), radial-gradient(900px 500px at 110% 10%, #dbe6fe 0%, transparent 55%), #eff1f5",
  },
  gruvbox: {
    id: "gruvbox", scheme: "light", family: "Gruvbox Light",
    fonts: { sans: sans("Golos Text"), heading: `'Literata', Georgia, 'Times New Roman', serif`, mono: mono("JetBrains Mono") },
    fontKeys: ["golos-text", "literata", "jetbrains-mono"],
    palette: {
      bg: "#fbf1c7", surface: "#fdf6d8", surface2: "#f9edc0", sunken: "#f2e5bc", hover: "#f2e5bc", selected: "#ebdbb2",
      ink: "#3c3836", ink2: "#504945", muted: "#7c6f64", faint: "#a89984", rule: "#e0cfa3", ruleStrong: "#d5c4a1",
      accent: "#af3a03", accentWeak: "#f6d9b8", accentInk: "#fbf1c7", accent2: "#076678",
      ok: "#79740e", okWeak: "#ece6b0", warn: "#b57614", warnWeak: "#f4e1a6", err: "#9d0006", errWeak: "#f3cfc0", crit: "#7a0005",
      info: "#076678", infoWeak: "#d6e5d8", off: "#a89984", overlay: "rgba(60,56,54,.3)",
    },
    series: ["#af3a03", "#076678", "#79740e", "#b57614", "#8f3f71", "#427b58", "#9d0006", "#7c6f64"],
    geometry: { rSm: 2, rMd: 3, rLg: 5, border: 1.5, shadow: "none" },
    type: { base: 13.5, scale: 1.25, headingWeight: 600, headingTracking: "0", headingCase: "none", lh: 1.5 },
    density: { row: 32, ctl: 30 },
    wallpaper: "repeating-linear-gradient(0deg, transparent 0 27px, rgba(124,111,100,.08) 27px 28px), #fbf1c7",
  },
  mocha: {
    id: "mocha", scheme: "dark", family: "Catppuccin Mocha",
    fonts: { sans: sans("Onest"), heading: sans("Onest"), mono: mono("JetBrains Mono") },
    fontKeys: ["onest", "jetbrains-mono"],
    palette: {
      bg: "#1e1e2e", surface: "#24243a", surface2: "#28283e", sunken: "#181825", hover: "#313244", selected: "#3a3b52",
      ink: "#cdd6f4", ink2: "#bac2de", muted: "#a6adc8", faint: "#6c7086", rule: "#313244", ruleStrong: "#45475a",
      accent: "#cba6f7", accentWeak: "#3b3150", accentInk: "#1e1e2e", accent2: "#f5c2e7",
      ok: "#a6e3a1", okWeak: "#26372c", warn: "#f9e2af", warnWeak: "#3d372a", err: "#f38ba8", errWeak: "#43283a", crit: "#eba0ac",
      info: "#89b4fa", infoWeak: "#25304a", off: "#6c7086", overlay: "rgba(17,17,27,.6)",
    },
    series: ["#cba6f7", "#89b4fa", "#fab387", "#a6e3a1", "#f5c2e7", "#94e2d5", "#f9e2af", "#f38ba8"],
    geometry: { rSm: 8, rMd: 12, rLg: 18, border: 1, shadow: "0 1px 0 rgba(255,255,255,.03) inset, 0 12px 32px -16px rgba(0,0,0,.6)" },
    type: { base: 13.5, scale: 1.2, headingWeight: 700, headingTracking: "-0.015em", headingCase: "none", lh: 1.5 },
    density: { row: 36, ctl: 32 },
    wallpaper: "radial-gradient(1100px 600px at 0% 0%, rgba(203,166,247,.12) 0%, transparent 60%), radial-gradient(900px 500px at 100% 100%, rgba(137,180,250,.10) 0%, transparent 55%), #1e1e2e",
  },
  tokyo: {
    id: "tokyo", scheme: "dark", family: "Tokyo Night",
    fonts: { sans: mono("JetBrains Mono"), heading: mono("JetBrains Mono"), mono: mono("JetBrains Mono") },
    fontKeys: ["jetbrains-mono"],
    palette: {
      bg: "#1a1b26", surface: "#1f2335", surface2: "#222639", sunken: "#16161e", hover: "#292e42", selected: "#2f3549",
      ink: "#c0caf5", ink2: "#a9b1d6", muted: "#7a88b8", faint: "#565f89", rule: "#292e42", ruleStrong: "#3b4261",
      accent: "#7aa2f7", accentWeak: "#24304f", accentInk: "#16161e", accent2: "#bb9af7",
      ok: "#9ece6a", okWeak: "#26331f", warn: "#e0af68", warnWeak: "#3a3021", err: "#f7768e", errWeak: "#3d2230", crit: "#ff9e64",
      info: "#7dcfff", infoWeak: "#1d3242", off: "#565f89", overlay: "rgba(10,10,16,.65)",
    },
    series: ["#7aa2f7", "#bb9af7", "#9ece6a", "#e0af68", "#7dcfff", "#f7768e", "#ff9e64", "#73daca"],
    geometry: { rSm: 0, rMd: 2, rLg: 3, border: 1, shadow: "none" },
    type: { base: 12.5, scale: 1.15, headingWeight: 700, headingTracking: "0.04em", headingCase: "uppercase", lh: 1.55 },
    density: { row: 30, ctl: 28 },
    wallpaper: "linear-gradient(rgba(122,162,247,.05) 1px, transparent 1px) 0 0/24px 24px, linear-gradient(90deg, rgba(122,162,247,.05) 1px, transparent 1px) 0 0/24px 24px, #1a1b26",
  },
};
export const SKIN_IDS = Object.keys(SKINS) as SkinId[];
export const LIGHT_SKINS: SkinId[] = ["latte", "gruvbox"];
export const DARK_SKINS: SkinId[] = ["mocha", "tokyo"];
export function isSkin(v: unknown): v is SkinId {
  return typeof v === "string" && v in SKINS;
}
/** CSS custom properties for the root document. */
export function skinVariables(skin: Skin, compact = false): Record<string, string> {
  const p = skin.palette, g = skin.geometry, ty = skin.type;
  const b = compact ? ty.base - 0.5 : ty.base;
  const px = (n: number) => Math.round(n * 10) / 10 + "px";
  return {
    "--bg": p.bg, "--surface": p.surface, "--surface-2": p.surface2, "--sunken": p.sunken, "--hover": p.hover, "--selected": p.selected,
    "--ink": p.ink, "--ink-2": p.ink2, "--muted": p.muted, "--faint": p.faint, "--rule": p.rule, "--rule-strong": p.ruleStrong,
    "--accent": p.accent, "--accent-weak": p.accentWeak, "--accent-ink": p.accentInk, "--accent-2": p.accent2,
    "--ok": p.ok, "--ok-weak": p.okWeak, "--warn": p.warn, "--warn-weak": p.warnWeak, "--err": p.err, "--err-weak": p.errWeak, "--crit": p.crit,
    "--info": p.info, "--info-weak": p.infoWeak, "--off": p.off, "--overlay": p.overlay,
    "--chart-grid": p.rule, "--chart-axis": p.faint,
    "--font-sans": skin.fonts.sans, "--font-heading": skin.fonts.heading, "--font-mono": skin.fonts.mono,
    "--fs-xs": px(b - 2.5), "--fs-sm": px(b - 1.5), "--fs-md": px(b - 0.5), "--fs-lg": px(b * 1.1), "--fs-xl": px(b * ty.scale * 1.15), "--fs-2xl": px(b * ty.scale ** 2 * 1.2), "--fs-num": px(b * ty.scale ** 3 * 1.2),
    "--lh": String(ty.lh),
    "--r-sm": g.rSm + "px", "--r-md": g.rMd + "px", "--r-lg": g.rLg + "px", "--border-w": g.border + "px", "--shadow": g.shadow,
    "--heading-weight": String(ty.headingWeight), "--heading-tracking": ty.headingTracking, "--heading-case": ty.headingCase,
    "--row": (compact ? skin.density.row - 4 : skin.density.row) + "px", "--ctl": (compact ? skin.density.ctl - 4 : skin.density.ctl) + "px",
    "--wallpaper": skin.wallpaper,
  };
}
/** Bounded, plain-data theme description for isolated plugin frames. No CSS text, no URLs. */
export interface PluginThemeTokens {
  skin: SkinId;
  scheme: Scheme;
  family: string;
  fonts: { sans: string; heading: string; mono: string };
  fontKeys: string[];
  colors: Skin["palette"];
  series: string[];
  radius: { sm: number; md: number; lg: number };
  border: number;
  density: "compact" | "comfortable";
  type: Skin["type"];
}
export function pluginTokens(skin: Skin, compact = false): PluginThemeTokens {
  return {
    skin: skin.id, scheme: skin.scheme, family: skin.family, fonts: { ...skin.fonts }, fontKeys: [...skin.fontKeys],
    colors: { ...skin.palette }, series: [...skin.series],
    radius: { sm: skin.geometry.rSm, md: skin.geometry.rMd, lg: skin.geometry.rLg }, border: skin.geometry.border,
    density: compact ? "compact" : "comfortable", type: { ...skin.type },
  };
}
