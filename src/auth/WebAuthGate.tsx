import { authError } from "./errors";
import { NativeOnboarding } from "../host/NativeOnboarding";
import { useEffect, useState, type ReactNode } from "react";
import { LockKeyhole } from "../ui/icons";
import { useApi } from "../app/ApiContext";
import { useQuery, queryClient } from "../app/query";
import { hostBridge } from "../host/contract";
import { tr } from "../i18n";
import { Button, Panel, Segmented } from "../ui/primitives";
import { Skeleton } from "../ui/states";
import {
  readConnectionSettings,
  writeConnectionSettings,
  createCoreApi,
} from "../api";
import { isCoreEndpoint } from "../api/endpoints";
import { sessionRequest, signInWithKey } from "./key-login";
import { useResolvedTheme } from "../app/theme";
let setupExchange: Promise<unknown> | undefined,
  setupCode = "";
export function WebAuthGate({ children }: { children: ReactNode }) {
  const api = useApi();
  const theme = useResolvedTheme();
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  return hostBridge() ? (
    <NativeOnboarding>{children}</NativeOnboarding>
  ) : api.mode === "mock" ? (
    <>{children}</>
  ) : (
    <Gate>{children}</Gate>
  );
}
function Gate({ children }: { children: ReactNode }) {
  const info = useQuery("info", (a) => a.info(), { refetchMs: 15000 }),
    [settingUp, setSettingUp] = useState(false),
    [setupError, setSetupError] = useState("");
  const theme = useResolvedTheme();
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  useEffect(() => {
    const exchange = () => {
      const params = new URLSearchParams(location.hash.split("?")[1] || ""),
        code = params.get("code");
      if (!code) return;
      history.replaceState(null, "", location.pathname + "#/identity?setup=1");
      setSettingUp(true);
      if (!setupExchange || setupCode !== code) {
        setupCode = code;
        setupExchange = sessionRequest("bootstrap", { code });
      }
      void setupExchange
        .then(() => {
          writeConnectionSettings({ mode: "http", baseUrl: "/api" });
          location.reload();
        })
        .catch((e) => setSetupError(authError(e)))
        .finally(() => setSettingUp(false));
    };
    window.addEventListener("hashchange", exchange);
    exchange();
    return () => window.removeEventListener("hashchange", exchange);
  }, []);
  if (settingUp || (!info.data && !info.error))
    return (
      <main className="auth-page">
        <div className="auth-card">
          <Skeleton h={180} />
        </div>
      </main>
    );
  if (info.data?.principal && !info.error) return <>{children}</>;
  return (
    <SignIn
      error={
        setupError ||
        (info.error &&
        !["unauthorized", "forbidden"].includes(info.error.code) &&
        ![401, 403].includes(info.error.status)
          ? info.error.message
          : "")
      }
      retry={info.refetch}
    />
  );
}
function SignIn({
  error: outerError,
  retry,
}: {
  error: string;
  retry: () => void;
}) {
  const [mode, setMode] = useState<"key" | "token" | "setup" | "recover">(
      new URLSearchParams(location.hash.split("?")[1] || "").has("recover")
        ? "recover"
        : "key",
    ),
    [secret, setSecret] = useState(""),
    [endpoint, setEndpoint] = useState(readConnectionSettings().baseUrl),
    [remember, setRemember] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      if (mode === "key") {
        await signInWithKey(secret, remember);
        writeConnectionSettings({ mode: "http", baseUrl: "/api" });
      } else if (mode === "setup") {
        let code = secret.trim();
        if (code.includes("://")) {
          const u = new URL(code);
          if (u.origin !== location.origin)
            throw Error(tr("auth.wrongNodeLink"));
          code =
            new URLSearchParams(u.hash.split("?")[1] || "").get("code") || "";
        }
        await sessionRequest("bootstrap", { code });
        location.hash = "#/identity?setup=1";
        writeConnectionSettings({ mode: "http", baseUrl: "/api" });
      } else {
        if (!isCoreEndpoint(endpoint)) throw Error(tr("auth.invalidEndpoint"));
        const u = new URL(endpoint, location.origin);
        if (
          u.protocol !== "https:" &&
          !["localhost", "127.0.0.1", "[::1]"].includes(u.hostname)
        )
          throw Error(tr("auth.https"));
        const s = { mode: "http" as const, baseUrl: endpoint, token: secret };
        await createCoreApi(s).info();
        writeConnectionSettings(s);
      }
      setSecret("");
      queryClient.clear();
      location.reload();
    } catch (e) {
      setError(authError(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="auth-page">
      <div className="auth-card">
        <header
          className="row"
          style={{ justifyContent: "space-between", marginBottom: 20 }}
        >
          <strong className="row gap-2">
            <LockKeyhole size={22} />
            {"Delta"}
          </strong>
        </header>
        <Panel
          title={
            <h1 style={{ fontSize: "inherit", margin: 0 }}>
              {tr("auth.title")}
            </h1>
          }
        >
          <form
            className="col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <p className="muted">{tr("auth.description")}</p>
            <Segmented
              value={mode}
              onChange={(v) => {
                setMode(v);
                setSecret("");
                setError("");
              }}
              options={(["key", "setup", "recover"] as const).map((value) => ({
                value,
                label: tr("auth." + value),
              }))}
            />
            {(error || outerError) && (
              <div className="banner err" role="alert">
                {error || outerError}
              </div>
            )}
            {mode === "recover" ? (
              <div className="col gap-3 recovery-help">
                <p>{tr("auth.recoverDescription")}</p>
                <ol>
                  <li>{tr("auth.recoverStep1")}</li>
                  <li>{tr("auth.recoverStep2")}</li>
                  <li>{tr("auth.recoverStep3")}</li>
                </ol>
                <a
                  className="btn"
                  href="https://github.com/n-ycta/delta/blob/main/docs/recover-access.md"
                  target="_blank"
                  rel="noreferrer"
                >
                  {tr("auth.instructions")}
                </a>
                <Button type="button" onClick={() => setMode("setup")}>
                  {tr("auth.haveLink")}
                </Button>
              </div>
            ) : (
              <>
                {mode === "token" && (
                  <label>
                    {tr("auth.endpoint")}
                    <input
                      className="input"
                      value={endpoint}
                      onChange={(e) => setEndpoint(e.target.value)}
                      autoComplete="url"
                    />
                  </label>
                )}
                <label>
                  {tr(
                    mode === "key"
                      ? "polish.secretKey"
                      : mode === "setup"
                        ? "auth.setupCode"
                        : "auth.apiToken",
                  )}
                  <input
                    className="input"
                    type="password"
                    autoComplete={mode === "setup" ? "one-time-code" : "off"}
                    spellCheck={false}
                    value={secret}
                    onChange={(e) => setSecret(e.target.value)}
                    maxLength={2048}
                  />
                </label>
                {mode === "key" && (
                  <>
                    <p className="muted">{tr("polish.keyPrivacy")}</p>
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={remember}
                        onChange={(e) => setRemember(e.target.checked)}
                      />
                      {tr("polish.rememberDevice")}
                    </label>
                  </>
                )}
                {mode === "setup" && (
                  <p className="muted">{tr("auth.setupHint")}</p>
                )}
                <div className="row gap-2">
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={!secret || busy}
                  >
                    {tr("polish.login")}
                  </Button>
                  <Button type="button" onClick={retry} disabled={busy}>
                    {tr("auth.retry")}
                  </Button>
                </div>
                <p className="muted">{tr("auth.noRegistration")}</p>
              </>
            )}
            {mode !== "recover" && (
              <button
                type="button"
                className="auth-advanced"
                onClick={() => {
                  setMode(mode === "token" ? "key" : "token");
                  setSecret("");
                  setError("");
                }}
              >
                {tr(mode === "token" ? "auth.key" : "auth.token")}
              </button>
            )}
          </form>
        </Panel>
      </div>
    </main>
  );
}
