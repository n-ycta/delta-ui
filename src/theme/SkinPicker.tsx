import { usePrefs } from "../app/stores";
import { useResolvedTheme, useSkin } from "../app/theme";
import { SKINS, SKIN_IDS, type SkinId } from "./skins";
import { s } from "../shell/strings";
/** Global theme choice. Each card is rendered in the skin's own palette and typefaces. */
export function SkinPicker({ compact = false }: { compact?: boolean }) {
  const prefs = usePrefs();
  const active = useSkin();
  const resolved = useResolvedTheme();
  const choose = (id: SkinId) => {
    const skin = SKINS[id];
    const patch: Partial<typeof prefs> =
      skin.scheme === "light" ? { lightSkin: id as "latte" | "gruvbox" } : { darkSkin: id as "mocha" | "tokyo" };
    if (!(prefs.theme === "system" && resolved === skin.scheme)) patch.theme = skin.scheme;
    prefs.set(patch);
  };
  return (
    <div className={"dx-skins" + (compact ? " compact" : "")}>
      <div className="dx-skin-grid" role="radiogroup" aria-label={s("theme")}>
        {SKIN_IDS.map((id) => {
          const k = SKINS[id], c = k.palette;
          const paired = (k.scheme === "light" ? prefs.lightSkin : prefs.darkSkin) === id;
          return (
            <button
              key={id}
              role="radio"
              aria-checked={active.id === id}
              data-skin-choice={id}
              className={"dx-skin" + (active.id === id ? " active" : paired ? " paired" : "")}
              onClick={() => choose(id)}
              style={{ background: c.bg, color: c.ink, borderColor: active.id === id ? c.accent : c.ruleStrong, borderRadius: Math.max(4, k.geometry.rLg) }}
            >
              <span className="dx-skin-window" style={{ background: c.surface, borderColor: c.rule, borderRadius: k.geometry.rMd }}>
                <span className="dx-skin-bar" style={{ background: c.sunken }}>
                  <i style={{ background: c.err }} /><i style={{ background: c.warn }} /><i style={{ background: c.ok }} />
                </span>
                <span className="dx-skin-sample" style={{ fontFamily: k.fonts.heading, fontWeight: k.type.headingWeight, letterSpacing: k.type.headingTracking, textTransform: k.type.headingCase, fontStyle: id === "gruvbox" ? "italic" : undefined }}>
                  {s("sampleHeading")}
                </span>
                <span className="dx-skin-text" style={{ fontFamily: k.fonts.sans, color: c.muted }}>{s("sampleText")}</span>
                <span className="dx-skin-row">
                  <b style={{ background: c.accent, color: c.accentInk, borderRadius: k.geometry.rSm, fontFamily: k.fonts.sans }}>{s("sampleButton")}</b>
                  {k.series.slice(0, 5).map((x) => <i key={x} style={{ background: x, borderRadius: k.geometry.rSm }} />)}
                </span>
              </span>
              <span className="dx-skin-meta" style={{ fontFamily: k.fonts.sans }}>
                <strong>{k.family}</strong>
                <small style={{ color: c.muted }}>{`${s(k.scheme === "light" ? "light" : "dark")} · ${k.fonts.heading.split(",")[0].replace(/'/g, "")}`}</small>
              </span>
            </button>
          );
        })}
      </div>
      <div className="dx-segment" role="radiogroup" aria-label={s("scheme")}>
        {(["light", "dark", "system"] as const).map((m) => (
          <button key={m} role="radio" aria-checked={prefs.theme === m} className={prefs.theme === m ? "active" : ""} onClick={() => prefs.set({ theme: m })}>
            {s(m === "system" ? "auto" : m)}
          </button>
        ))}
      </div>
      {!compact && <p className="dx-hint">{s("themeHint")}</p>}
    </div>
  );
}
