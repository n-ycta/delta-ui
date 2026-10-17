import { useEffect } from "react";
import { useSkin } from "../app/theme";
import { usePrefs } from "../app/stores";
import { skinVariables, pluginTokens, type PluginThemeTokens } from "./skins";
import "./fonts";
import "./skins.css";
let current: PluginThemeTokens | null = null;
export const SKIN_EVENT = "delta:skin";
export function currentPluginTokens() {
  return current;
}
/** Applies the single global skin to the root document. Mounted once per document. */
export function SkinRoot() {
  const skin = useSkin();
  const density = usePrefs((s) => s.density);
  useEffect(() => {
    const root = document.documentElement;
    const compact = density === "compact";
    const vars = skinVariables(skin, compact);
    for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
    root.dataset.theme = skin.scheme;
    root.dataset.skin = skin.id;
    root.dataset.density = density;
    root.style.colorScheme = skin.scheme;
    current = pluginTokens(skin, compact);
    const meta = document.querySelector('meta[name="theme-color"]') || Object.assign(document.createElement("meta"), { name: "theme-color" });
    meta.setAttribute("content", skin.palette.bg);
    if (!meta.parentNode) document.head.append(meta);
    window.dispatchEvent(new CustomEvent(SKIN_EVENT, { detail: current }));
  }, [skin, density]);
  return null;
}
