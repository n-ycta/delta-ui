import { MEDIA_API, pluginApiCall } from "../../sdk/pluginApi";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { appCall } from "../../sdk/apps";
import { pluginChannel } from "../../sdk/channel";
import { language, tr } from "../../i18n";
import { useResolvedTheme, useSkin } from "../../app/theme";
import { usePrefs } from "../../app/stores";
import { pluginTokens } from "../../theme/skins";
import { AppSlot } from "../../shell/frames";
import { readMediaState, registerMediaCommander, useNowPlaying } from "../../shell/state";
import { registerReceiver, routeIntent } from "../../shell/intents";
/** Full-page app route. The frame itself lives in the root FrameHost and survives navigation. */
export function PluginApp() {
  const { id } = useParams();
  return id ? <AppSlot id={id} className="dx-app-page" /> : null;
}
export function PluginSurface({
  id,
  surface,
  inline = false,
  themeOverride,
}: {
  id?: string;
  surface?: string;
  inline?: boolean;
  themeOverride?: "light" | "dark";
}) {
  const resolvedTheme = useResolvedTheme();
  const skin = useSkin();
  const density = usePrefs((s) => s.density);
  const theme = themeOverride || resolvedTheme;
  const tokens = useMemo(() => pluginTokens(skin, density === "compact"), [skin, density]);
  const brokerRef = useRef<ReturnType<typeof pluginChannel> | undefined>(undefined);
  const presentation = useRef({ appId: id, language, theme, surface, tokens });
  presentation.current = { appId: id, language, theme, surface, tokens };
  const frame = useRef<HTMLIFrameElement>(null);
  const [src, setSrc] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    setSrc("");
    setError("");
    void appCall("host.apps_launch", { id })
      .then((result: any) => {
        if (cancelled) return;
        const u = new URL(result.url);
        const appOrigin = u.origin === "null" ? u.protocol + "//" + u.host : u.origin;
        const rootOrigin = location.origin === "null" ? location.protocol + "//" + location.host : location.origin;
        if (
          appOrigin === rootOrigin ||
          (!["http:", "https:"].includes(u.protocol) && !/^deltaapp-[a-z0-9-]+:$/.test(u.protocol))
        )
          throw Error("invalid_app_origin");
        u.searchParams.set("embedded", "1");
        u.searchParams.set("parentOrigin", rootOrigin);
        u.searchParams.set("language", language);
        u.searchParams.set("theme", theme);
        u.searchParams.set("skin", skin.id);
        if (surface) {
          u.searchParams.set("surface", surface);
          u.searchParams.set("chrome", "0");
        }
        setSrc(u.href);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);
  useEffect(() => {
    if (!src || !id) return;
    let broker: ReturnType<typeof pluginChannel> | undefined;
    const u = new URL(src);
    const origin = u.origin === "null" ? u.protocol + "//" + u.host : u.origin;
    const post = (msg: Record<string, unknown>) => {
      if (broker) frame.current?.contentWindow?.postMessage({ ...msg, channel: broker.channel }, origin);
    };
    const initialize = () => {
      const source = frame.current?.contentWindow;
      if (!source) return;
      if (!broker)
        broker = pluginChannel({
          source,
          origin,
          grants: new Set(id === 'dev.delta.media' ? MEDIA_API : []),
          call: request => pluginApiCall(id!, request.capability, request.args || {}),
        });
      brokerRef.current = broker;
      source.postMessage({ type: "delta:initialize", channel: broker.channel, context: presentation.current }, origin);
    };
    const receive = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow || e.origin !== origin) return;
      const d = e.data;
      if (d?.type === "delta:ready") return initialize();
      if (!broker || d?.channel !== broker.channel) return;
      if (d.type === "delta:media-state") useNowPlaying.getState().report(id, d.state === null ? null : readMediaState(d.state));
      if (d.type === "delta:intent" && typeof d.intent === "string" && d.intent.length <= 64) {
        const result = routeIntent(id, d.intent, d.payload);
        if (typeof d.id === "string" && d.id.length <= 80) post({ type: "delta:intent-result", id: d.id, result });
      }
    };
    window.addEventListener("message", receive);
    const node = frame.current;
    node?.addEventListener("load", initialize);
    const offMedia = registerMediaCommander(id, (command) => post({ type: "delta:media-command", command }));
    const offIntents = registerReceiver(id, (intent, payload, from) => post({ type: "delta:intent", intent, payload, from }));
    return () => {
      broker?.revoke();
      brokerRef.current = undefined;
      offMedia();
      offIntents();
      useNowPlaying.getState().report(id, null);
      window.removeEventListener("message", receive);
      node?.removeEventListener("load", initialize);
    };
  }, [src, id]);
  useEffect(() => {
    if (!src || !brokerRef.current) return;
    const u = new URL(src);
    const origin = u.origin === "null" ? u.protocol + "//" + u.host : u.origin;
    frame.current?.contentWindow?.postMessage(
      { type: "delta:presentation", channel: brokerRef.current.channel, context: presentation.current },
      origin,
    );
  }, [src, theme, surface, tokens]);
  return error ? (
    <div className="page">
      <div role="alert" className="banner err">
        {error}
      </div>
    </div>
  ) : src ? (
    <div className={"plugin-app-host" + (inline ? " inline" : "")}>
      <iframe
        ref={frame}
        src={src}
        title={id || "Delta"}
        className="plugin-app-frame"
        sandbox="allow-scripts allow-same-origin allow-downloads allow-forms allow-popups"
        allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
      />
    </div>
  ) : (
    <div className="page" role="status">
      {tr("apps.loading")}
    </div>
  );
}
