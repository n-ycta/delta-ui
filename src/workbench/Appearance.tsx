import type { Application } from "./model";
import { WIcon } from "./Icon";
import { t } from "./strings";
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
    </>
  );
}
