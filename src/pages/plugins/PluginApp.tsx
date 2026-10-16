import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft } from "@phosphor-icons/react";
import { appCall } from "../../sdk/apps";
import { pluginChannel } from "../../sdk/channel";
import { language, tr } from "../../i18n";
import { useResolvedTheme } from "../../app/theme";
export function PluginApp(){const {id}=useParams();return <PluginSurface id={id}/>}
export function PluginSurface({id,surface,inline=false,themeOverride}:{id?:string;surface?:string;inline?:boolean;themeOverride?:'light'|'dark'}) {
  const resolvedTheme = useResolvedTheme();
  const theme=themeOverride||resolvedTheme;
  const brokerRef=useRef<ReturnType<typeof pluginChannel>|undefined>(undefined);
  const presentation=useRef({appId:id,language,theme,surface});presentation.current={appId:id,language,theme,surface};
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
        const appOrigin=u.origin === "null" ? u.protocol + "//" + u.host : u.origin;
        const rootOrigin=location.origin === "null" ? location.protocol + "//" + location.host : location.origin;
        if (
          appOrigin === rootOrigin ||
          (!["http:", "https:"].includes(u.protocol) &&
            !/^deltaapp-[a-z0-9-]+:$/.test(u.protocol))
        )
          throw Error("invalid_app_origin");
        u.searchParams.set("embedded", "1");
        const parentOrigin =
          location.origin === "null"
            ? location.protocol + "//" + location.host
            : location.origin;
        u.searchParams.set("parentOrigin", parentOrigin);
        u.searchParams.set("language", language);
        u.searchParams.set("theme", theme);
        if(surface){u.searchParams.set("surface",surface);u.searchParams.set("chrome","0")}
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
      brokerRef.current=broker;
      source.postMessage(
        {
          type: "delta:initialize",
          channel: broker.channel,
          context: presentation.current,
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
      broker?.revoke();brokerRef.current=undefined;
      window.removeEventListener("message", ready);
      node?.removeEventListener("load", initialize);
    };
  }, [src, id]);
  useEffect(()=>{if(!src||!brokerRef.current)return;const u=new URL(src);const origin=u.origin==='null'?u.protocol+'//'+u.host:u.origin;frame.current?.contentWindow?.postMessage({type:'delta:presentation',channel:brokerRef.current.channel,context:presentation.current},origin)},[src,theme,surface]);
  return error ? (
    <div className="page">
      <div role="alert" className="banner err">
        {error}
      </div>
    </div>
  ) : src ? (
    <div className="plugin-app-host">
      {!inline&&<div className="plugin-app-toolbar">
        <Link className="btn ghost" to="/plugins">
          <ArrowLeft size={16} />
          {tr("apps.console")}
        </Link>
      </div>}
      <iframe
        ref={frame}
        src={src}
        title={id || "Delta"}
        className="plugin-app-frame"
        sandbox="allow-scripts allow-same-origin allow-downloads allow-forms"
        allow="autoplay; fullscreen; picture-in-picture"
      />
    </div>
  ) : (
    <div className="page" role="status">
      {tr("apps.loading")}
    </div>
  );
}
