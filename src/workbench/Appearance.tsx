import type { Application, Nav, Theme } from "./model";
import { Select } from "../ui/Select";
import { WIcon } from "./Icon";
import { t } from "./strings";
const themes: Theme[] = ["paper", "daylight", "graphite", "midnight"];
const navs: Nav[] = ["side", "top", "bottom", "dock", "hidden"];
export function Appearance({
  app,
  patch,
  chooseBrand,
}: {
  app: Application;
  patch: (p: Partial<Application>) => void;
  chooseBrand: () => void;
}) {
  return (
    <>
      <h3>{t("theme")}</h3>
      <div className="wb-themes">
        {themes.map((k) => (
          <button
            key={k}
            data-theme-choice={k}
            className={app.theme === k ? "selected" : ""}
            onClick={() => patch({ theme: k })}
          >
            <span />
            <b>{t(k)}</b>
          </button>
        ))}
      </div>
      <label>
        {t("navigation")}
        <Select
          value={app.nav}
          onChange={(e) => patch({ nav: e.target.value as Nav })}
        >
          {navs.map((n) => (
            <option key={n} value={n}>
              {t(n)}
            </option>
          ))}
        </Select>
      </label>
      <label>
        {t("mobile")}
        <Select
          value={app.mobileNav}
          onChange={(e) => patch({ mobileNav: e.target.value as Nav })}
        >
          {navs.map((n) => (
            <option key={n} value={n}>
              {t(n)}
            </option>
          ))}
        </Select>
      </label>
      <label>
        {t("brand")}
        <input
          maxLength={120}
          value={app.brandName}
          onChange={(e) => patch({ brandName: e.target.value })}
        />
      </label>
      <button onClick={chooseBrand}>
        <WIcon
          name={app.brandSymbol === "delta" ? "triangle" : app.brandSymbol}
        />
        {t("logo")}
      </button>
      <label className="wb-check">
        <input
          type="checkbox"
          checked={app.chrome}
          onChange={(e) => patch({ chrome: e.target.checked })}
        />
        {t("chrome")}
      </label>
      <label className="wb-check">
        <input
          type="checkbox"
          checked={app.brand}
          onChange={(e) => patch({ brand: e.target.checked })}
        />
        {t("brand")}
      </label>
      <label className="wb-check">
        <input
          type="checkbox"
          checked={app.logo}
          onChange={(e) => patch({ logo: e.target.checked })}
        />
        {t("logo")}
      </label>
      <label>
        {t("accent")}
        <input
          type="color"
          value={app.accent}
          onChange={(e) => patch({ accent: e.target.value })}
        />
        <input
          key={app.accent}
          aria-label="HEX"
          defaultValue={app.accent}
          pattern="#[0-9a-fA-F]{6}"
          onBlur={(e) => {
            if (/^#[0-9a-f]{6}$/i.test(e.target.value))
              patch({ accent: e.target.value });
          }}
        />
      </label>
      <label>
        {t("gap")}
        {" · "}
        {app.gap}
        <input
          type="range"
          min={8}
          max={32}
          step={4}
          value={app.gap}
          onChange={(e) => patch({ gap: Number(e.target.value) })}
        />
      </label>
      <label>
        {t("radius")}
        {" · "}
        {app.radius}
        <input
          type="range"
          min={0}
          max={24}
          step={2}
          value={app.radius}
          onChange={(e) => patch({ radius: Number(e.target.value) })}
        />
      </label>
    </>
  );
}
