import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { appCall } from "../../sdk/apps";
import { tr } from "../../i18n";
import { Button, Panel } from "../../ui/primitives";
import { ArrowUpCircle, Download, Play, Trash2 } from "../../ui/icons";
interface AppSummary {
  id: string;
  name: string;
  version: string;
}
function readSummaries(value: unknown): AppSummary[] {
  return Array.isArray(value)
    ? value
        .slice(0, 128)
        .filter(
          (v): v is AppSummary =>
            !!v &&
            typeof v.id === "string" &&
            v.id.length <= 128 &&
            /^[a-z0-9.-]+$/.test(v.id) &&
            typeof v.name === "string" &&
            v.name.length <= 200 &&
            typeof v.version === "string" &&
            v.version.length <= 80,
        )
    : [];
}
export function PortableApps() {
  const [catalog, setCatalog] = useState<AppSummary[]>([]),
    [installed, setInstalled] = useState<AppSummary[]>([]),
    [busy, setBusy] = useState(""),
    [error, setError] = useState("");
  async function refresh() {
    const [c, i] = await Promise.all([
      appCall("host.apps_catalog"),
      appCall("host.apps_list"),
    ]);
    setCatalog(readSummaries(c));
    setInstalled(readSummaries(i));
  }
  useEffect(() => {
    void refresh().catch((e) => setError(e.message));
  }, []);
  if (!catalog.length) return null;
  async function action(id: string, remove = false, replace = false) {
    setBusy(id);
    setError("");
    try {
      await appCall(remove ? "host.apps_remove" : "host.apps_install", {
        id,
        replace,
      });
      window.dispatchEvent(
        new CustomEvent("delta:apps-changed", { detail: { id } }),
      );
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  return (
    <Panel title={tr("apps.title")}>
      <div className="col gap-3">
        {error && (
          <div className="banner err" role="alert">
            {error}
          </div>
        )}
        {catalog.map((m) => (
          <div className="row gap-3" key={m.id}>
            <span className="grow">
              <strong>{m.name}</strong>
              <span className="muted mono">
                {" · "}
                {m.version}
              </span>
            </span>
            {installed.some((v) => v.id === m.id) ? (
              <>
                {installed.find((v) => v.id === m.id)?.version !==
                  m.version && (
                  <Button
                    disabled={!!busy}
                    onClick={() => {
                      if (confirm(tr("apps.updateConfirm")))
                        void action(m.id, false, true);
                    }}
                  >
                    <ArrowUpCircle size={16} />
                    {tr("apps.update")}
                  </Button>
                )}
                <Link className="btn" to={"/apps/" + m.id}>
                  <Play size={16} />
                  {tr("apps.open")}
                </Link>
                <Button
                  iconOnly
                  title={tr("apps.remove")}
                  aria-label={tr("apps.remove")}
                  disabled={!!busy}
                  onClick={() => {
                    if (confirm(tr("apps.removeConfirm")))
                      void action(m.id, true);
                  }}
                >
                  <Trash2 size={16} />
                </Button>
              </>
            ) : (
              <Button disabled={!!busy} onClick={() => void action(m.id)}>
                <Download size={16} />
                {busy === m.id ? tr("apps.installing") : tr("apps.install")}
              </Button>
            )}
          </div>
        ))}
      </div>
    </Panel>
  );
}
