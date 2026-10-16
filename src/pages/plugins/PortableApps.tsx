import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { hostBridge } from "../../host/contract";
import { tr } from "../../i18n";
import { Button, Panel } from "../../ui/primitives";
import { Download, Play, Trash2 } from "../../ui/icons";
export function PortableApps() {
  const host = hostBridge();
  const [catalog, setCatalog] = useState<any[]>([]),
    [installed, setInstalled] = useState<any[]>([]),
    [busy, setBusy] = useState(""),
    [error, setError] = useState("");
  async function refresh() {
    if (!host) return;
    const [c, i] = await Promise.all([
      host.call({ capability: "host.apps_catalog" }),
      host.call({ capability: "host.apps_list" }),
    ]);
    setCatalog(c as any[]);
    setInstalled(i as any[]);
  }
  useEffect(() => {
    void refresh().catch((e) => setError(e.message));
  }, []);
  if (!host || !catalog.length) return null;
  async function action(id: string, remove = false) {
    setBusy(id);
    setError("");
    try {
      await host!.call({
        capability: remove ? "host.apps_remove" : "host.apps_install",
        args: { id },
      });
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
