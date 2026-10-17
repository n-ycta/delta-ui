import { useEffect, useState } from "react";
import { WIcon } from "./Icon";
import { t } from "./strings";
import { language } from "../i18n";
import { useDesktops, workspaceCommand } from "../shell/workspaceBus";
import { useInstalledApps } from "../shell/apps";
import { useNowPlaying, mediaCommand, openAppManager } from "../shell/state";
import { useRunningApps } from "../shell/frames";
function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(id);
  }, []);
  return now;
}
function greeting(h: number) {
  return t(h < 5 ? "night" : h < 12 ? "morning" : h < 18 ? "day" : "evening");
}
/** Desktop start view: clock, quick launch, what is running and how to customise. */
export function DesktopHome({ live = false }: { live?: boolean }) {
  const now = useClock();
  const desktops = useDesktops();
  const apps = useInstalledApps(live);
  const running = useRunningApps((s) => s.running);
  const playing = useNowPlaying((s) => s.states);
  const media = Object.entries(playing).sort((a, b) => b[1].at - a[1].at)[0];
  const locale = language === "ru" ? "ru-RU" : "en-US";
  const tiles = [
    ...(live ? [{ key: "console", name: t("console"), icon: "terminal", hint: t("tileConsole"), open: () => (location.hash = "#/") }] : []),
    ...apps.map((a) => ({ key: a.id, name: a.name, icon: a.icon, hint: running.includes(a.id) ? t("running") : a.version, open: () => (location.hash = "#/apps/" + encodeURIComponent(a.id)) })),
    ...desktops.apps
      .filter((d) => d.id !== desktops.active)
      .map((d) => ({ key: d.id, name: d.name, icon: d.icon, hint: t("desktop"), open: () => workspaceCommand({ op: "open", id: d.id }) })),
  ];
  return (
    <div className="dh">
      <header className="dh-hero">
        <div>
          <p className="dh-date">{now.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" })}</p>
          <h1 className="dh-time">{now.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}</h1>
          <p className="dh-greeting">{greeting(now.getHours())}</p>
        </div>
        {media && (
          <div className="dh-player" aria-live="polite">
            <span className="dh-player-art"><WIcon name={media[1].playing ? "waveform" : "music-notes"} size={22} /></span>
            <span className="dh-player-text">
              <strong>{media[1].title || t("media")}</strong>
              <small>{media[1].subtitle || media[0]}</small>
            </span>
            <button aria-label={t("previous")} title={t("previous")} disabled={!media[1].canPrev} onClick={() => mediaCommand(media[0], "prev")}><WIcon name="skip-back" /></button>
            <button className="dh-play" aria-label={media[1].playing ? t("pause") : t("play")} title={media[1].playing ? t("pause") : t("play")} onClick={() => mediaCommand(media[0], "toggle")}><WIcon name={media[1].playing ? "pause" : "play"} /></button>
            <button aria-label={t("next")} title={t("next")} disabled={!media[1].canNext} onClick={() => mediaCommand(media[0], "next")}><WIcon name="skip-forward" /></button>
          </div>
        )}
      </header>
      <section className="dh-section">
        <div className="dh-section-head">
          <h2>{t("quickLaunch")}</h2>
          <button className="dh-link" onClick={() => openAppManager("apps")}>{t("allApps")} <WIcon name="arrow-right" size={14} /></button>
        </div>
        <div className="dh-tiles">
          {tiles.map((x) => (
            <button key={x.key} className="dh-tile" onClick={x.open}>
              <span className="dh-tile-icon"><WIcon name={x.icon} size={22} /></span>
              <span className="dh-tile-text"><strong>{x.name}</strong><small>{x.hint}</small></span>
            </button>
          ))}
          <button className="dh-tile dh-tile-add" onClick={() => openAppManager("desktops")}>
            <span className="dh-tile-icon"><WIcon name="plus" size={22} /></span>
            <span className="dh-tile-text"><strong>{t("newDesktop")}</strong><small>{t("fromTemplate")}</small></span>
          </button>
        </div>
      </section>
      <section className="dh-tips">
        <div><WIcon name="plus-square" /><span>{t("tipAdd")}</span></div>
        <div><WIcon name="sliders-horizontal" /><span>{t("tipEdit")}</span></div>
        <div><WIcon name="palette" /><span>{t("tipTheme")}</span></div>
      </section>
    </div>
  );
}
