import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { hostBridge } from "../../host/contract";
import { pluginChannel } from "../../sdk/channel";
import { language, tr } from "../../i18n";
import { useResolvedTheme } from "../../app/theme";
export function PluginApp() {
  const { id } = useParams();
  const theme = useResolvedTheme();
  const frame = useRef<HTMLIFrameElement>(null);
  const [src, setSrc] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    setSrc("");
    setError("");
    const host = hostBridge();
    if (!host) {
      setError(tr("apps.unavailable"));
      return;
    }
    void host
      .call({ capability: "host.apps_launch", args: { id } })
      .then((result: any) => {
        if (cancelled) return;
        const u = new URL(result.url);
        if (!u.hostname.endsWith(".localhost") && u.hostname !== "localhost")
          throw Error("invalid_app_origin");
        u.searchParams.set("embedded", "1");
        u.searchParams.set("language", language);
        u.searchParams.set("theme", theme);
        setSrc(u.href);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [id, theme]);
  useEffect(() => {
    if (!src) return;
    let broker: ReturnType<typeof pluginChannel> | undefined;
    const u = new URL(src);
    const origin = u.origin === "null" ? u.protocol + "//" + u.host : u.origin;
    const initialize = () => {
      const source = frame.current?.contentWindow;
      if (!source) return;
      broker?.revoke();
      broker = pluginChannel({
        source,
        origin,
        grants: new Set(),
        call: async () => {
          throw Error("forbidden");
        },
      });
      source.postMessage(
        {
          type: "delta:initialize",
          channel: broker.channel,
          context: { appId: id, language, theme },
        },
        origin,
      );
    };
    const ready = (e: MessageEvent) => {
      if (
        e.source === frame.current?.contentWindow &&
        e.origin === origin &&
        e.data?.type === "delta:ready"
      )
        initialize();
    };
    window.addEventListener("message", ready);
    const node = frame.current;
    node?.addEventListener("load", initialize);
    return () => {
      broker?.revoke();
      window.removeEventListener("message", ready);
      node?.removeEventListener("load", initialize);
    };
  }, [src, id, theme]);
  return error ? (
    <div className="page">
      <div role="alert" className="banner err">
        {error}
      </div>
    </div>
  ) : src ? (
    <iframe
      ref={frame}
      src={src}
      title="Delta Media"
      className="plugin-app-frame"
      sandbox="allow-scripts allow-same-origin allow-downloads allow-forms"
      allow="autoplay; fullscreen; picture-in-picture"
    />
  ) : (
    <div className="page" role="status">
      {tr("apps.loading")}
    </div>
  );
}
