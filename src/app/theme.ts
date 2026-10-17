import { ThemeOverride } from "./AppearanceContext";
import { tr } from "../i18n";
import { useContext, useEffect, useState } from "react";
import { usePrefs } from "./stores";
import { SKINS, type Skin } from "../theme/skins";

export function useResolvedTheme(): "light" | "dark" {
  const override = useContext(ThemeOverride);
  const theme = usePrefs((s) => s.theme);
  const [sys, setSys] = useState(() =>
    window.matchMedia?.("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light",
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const h = () => setSys(mq.matches ? "dark" : "light");
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);
  return override ?? (theme === "system" ? (sys as "light" | "dark") : theme);
}

/** The active global skin. Every surface (Console, desktops, plugins) follows it. */
export function useSkin(): Skin {
  const scheme = useResolvedTheme();
  const light = usePrefs((s) => s.lightSkin), dark = usePrefs((s) => s.darkSkin);
  return SKINS[scheme === "dark" ? dark : light] ?? SKINS[scheme === "dark" ? "mocha" : "latte"];
}

/** Data palettes. Chosen for distinguishability on both paper and graphite backgrounds, without neon. */
export const PALETTES: Record<
  string,
  { label: string; light: string[]; dark: string[] }
> = {
  delta: {
    label: tr("app.theme.s_a4cbd21f4a"),
    light: [
      "#1F4E79",
      "#D9480F",
      "#5E7D2A",
      "#A86F12",
      "#6B4C8A",
      "#2C7A72",
      "#8A3B4A",
      "#6D6A62",
    ],
    dark: [
      "#7FA8D6",
      "#F27A3E",
      "#93B85A",
      "#D9AA4A",
      "#A88BC8",
      "#5FB3A8",
      "#D07A8A",
      "#A8A397",
    ],
  },
  ink: {
    label: tr("app.theme.s_e6d2543ef1"),
    light: ["#1A1A18", "#5B5850", "#8F8A7F", "#B9B3A6", "#D9480F", "#3E3C37"],
    dark: ["#ECEAE3", "#B4B0A6", "#827E75", "#57544E", "#F26B2B", "#D5D1C8"],
  },
  contrast: {
    label: tr("app.theme.s_fe3b049738"),
    light: ["#0057B8", "#E03C00", "#00875A", "#B8860B", "#8E24AA", "#00838F"],
    dark: ["#4DA3FF", "#FF7043", "#2ECC8F", "#FFC94D", "#CE7BE0", "#4DD0E1"],
  },
  earth: {
    label: tr("app.theme.s_42ff10b731"),
    light: ["#7A4E2D", "#4F6D3A", "#B5833A", "#3F5E6E", "#9C4A36", "#6E6450"],
    dark: ["#C99A72", "#9DBB7E", "#E2B56C", "#86AFC2", "#D88A72", "#B5AA90"],
  },
};

export function useChartColors(paletteOverride?: string) {
  const theme = useResolvedTheme();
  const pref = usePrefs((s) => s.palette);
  const skin = useSkin();
  const name = paletteOverride ?? pref;
  const p = PALETTES[name] ?? PALETTES.delta;
  const dark = theme === "dark", c = skin.palette;
  return {
    series: name === "delta" || !PALETTES[name] ? skin.series : dark ? p.dark : p.light,
    grid: c.rule,
    axis: c.faint,
    ink: c.ink,
    muted: c.faint,
    warn: c.warn,
    err: c.err,
    ok: c.ok,
    surface: c.surface,
    sunken: c.sunken,
    dark,
  };
}

/** Appearance is global: embedded surfaces change the same preference as the Console. */
export function useThemeSetter() {
  const set = usePrefs((s) => s.set);
  return (theme: "light" | "dark" | "system") => set({ theme });
}
