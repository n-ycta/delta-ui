import type { Application } from "./model";
import { t } from "./strings";
export function HomeAppearance({
  app,
  patch,
}: {
  app: Application;
  patch: (p: Partial<Application>) => void;
}) {
  const h = app.home;
  const set = (p: Partial<Application["home"]>) =>
    patch({ home: { ...h, ...p } });
  return (
    <section className="wb-home-options">
      <h3>{t("homeBlocks")}</h3>
      {(["date", "greeting", "description", "summary"] as const).map((key) => (
        <label key={key} className="wb-check">
          <input
            type="checkbox"
            checked={h[key]}
            onChange={(e) => set({ [key]: e.target.checked })}
          />
          {t(key)}
        </label>
      ))}
      <label>
        {t("heading")}
        <input
          maxLength={120}
          value={h.title}
          placeholder={t("automatic")}
          onChange={(e) => set({ title: e.target.value })}
        />
      </label>
      <label>
        {t("description")}
        <textarea
          maxLength={500}
          value={h.subtitle}
          placeholder={t("automatic")}
          onChange={(e) => set({ subtitle: e.target.value })}
        />
      </label>
    </section>
  );
}
