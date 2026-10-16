import { useCan, toast } from "../app/stores";
import { signInWithKey, keyFromInput, sessionRequest } from "../auth/key-login";
import { authError } from "../auth/errors";
import { hostBridge } from "../host/contract";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { schnorr } from "@noble/curves/secp256k1";
import { bytesToHex } from "@noble/hashes/utils";
import { generateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english";
import { control } from "../api/control";
import { tr } from "../i18n";
import { PageHead, Panel, Button } from "../ui/primitives";

export function IdentityPage() {
  const native = !!hostBridge(),
    canManage = useCan("access.manage");
  const [remember, setRemember] = useState(true),
    [secret, setSecret] = useState(""),
    [phrase, setPhrase] = useState(""),
    [saved, setSaved] = useState(false),
    [name, setName] = useState(""),
    [keys, setKeys] = useState<any[]>([]),
    [error, setError] = useState(""),
    [publicInput, setPublicInput] = useState(""),
    [importing, setImporting] = useState(false),
    [importSecret, setImportSecret] = useState(""),
    [busy, setBusy] = useState(false),
    [checked, setChecked] = useState(false),
    [owner, setOwner] = useState(false),
    [registered, setRegistered] = useState(false);
  const load = async () => {
    try {
      setKeys(await control("identity.list"));
      setOwner(true);
      return true;
    } catch (e) {
      setOwner(false);
      setError(authError(e));
      return false;
    } finally {
      setChecked(true);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const login = async (input = secret) => {
    setBusy(true);
    setError("");
    try {
      setSecret("");
      await signInWithKey(input, remember);
      sessionStorage.removeItem("delta.console.connection.token");
      location.hash = "#/identity";
      location.reload();
    } catch (e) {
      setError(authError(e));
    } finally {
      setBusy(false);
    }
  };
  const enroll = async () => {
    if (!owner || busy) return;
    setBusy(true);
    setError("");
    const localSecret = phrase || importSecret;
    let didRegister = registered;
    try {
      if (!didRegister) {
        let public_key = publicInput.trim();
        if (localSecret) {
          const key = keyFromInput(localSecret);
          try {
            public_key = bytesToHex(schnorr.getPublicKey(key));
          } finally {
            key.fill(0);
          }
        }
        await control("identity.enroll", {
          public_key,
          name: name.trim(),
          scopes: ["admin"],
        });
        setRegistered(true);
        didRegister = true;
      }
      await load();
      // Keep the draft in memory on error. Do not erase a newly registered key before verifying login.
      if (localSecret && !native) {
        await signInWithKey(localSecret, true);
        sessionStorage.removeItem("delta.console.connection.token");
        location.hash = "#/identity";
        location.reload();
        return;
      }
      setPhrase("");
      setImportSecret("");
      setPublicInput("");
      setSaved(false);
      setRegistered(false);
      toast({ severity: "success", title: tr("auth.keyRegistered") });
    } catch (e) {
      setError(
        didRegister
          ? tr("auth.registrationFailed") + " " + authError(e)
          : authError(e),
      );
      if ((e as { status?: number }).status === 401) setOwner(false);
    } finally {
      setBusy(false);
    }
  };
  const canEnroll = owner && canManage;
  return (
    <div className="page identity-page">
      <PageHead title={tr("polish.keys")} />
      {error && (
        <div className="banner err" role="alert">
          <span>{error}</span>
          {!owner && !native && (
            <a
              className="btn sm"
              href="#/identity?recover=1"
              onClick={() => location.reload()}
            >
              {tr("auth.recover")}
            </a>
          )}
        </div>
      )}
      {!checked && <p role="status">{tr("auth.verifyOwner")}</p>}
      <div className="grid-aside">
        {!native && (
          <Panel title={tr("polish.keyLogin")}>
            <div className="col gap-3">
              <p className="muted">{tr("polish.keyPrivacy")}</p>
              <label>
                {tr("polish.secretKey")}
                <input
                  type="password"
                  className="input"
                  autoComplete="off"
                  spellCheck={false}
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                />
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                {tr("polish.rememberDevice")}
              </label>
              <Button
                variant="primary"
                loading={busy}
                disabled={!secret}
                onClick={() => void login()}
              >
                {tr("polish.login")}
              </Button>
              <Button
                disabled={busy}
                onClick={() =>
                  void sessionRequest("logout", {})
                    .then(() => {
                      sessionStorage.removeItem(
                        "delta.console.connection.token",
                      );
                      location.reload();
                    })
                    .catch((e) => setError(authError(e)))
                }
              >
                {tr("polish.logout")}
              </Button>
            </div>
          </Panel>
        )}
        <div className="col gap-3">
          {canEnroll && (
            <Panel title={tr("polish.newIdentity")}>
              <div className="col gap-3">
                <label>
                  {tr("polish.identityName")}
                  <input
                    className="input"
                    value={name}
                    disabled={busy || registered}
                    maxLength={80}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <div className="row gap-2 wrap">
                  <Button
                    disabled={busy || registered}
                    onClick={() => {
                      setPhrase(generateMnemonic(wordlist, 128));
                      setImportSecret("");
                      setImporting(false);
                      setPublicInput("");
                      setSaved(false);
                    }}
                  >
                    {tr("auth.generate")}
                  </Button>
                  <Button
                    disabled={busy || registered}
                    onClick={() => {
                      setImporting(true);
                      setPhrase("");
                      setPublicInput("");
                      setSaved(false);
                    }}
                  >
                    {tr("auth.importKey")}
                  </Button>
                </div>
                {phrase ? (
                  <>
                    <div className="banner warn" role="status">
                      {tr(registered ? "auth.keyRegistered" : "auth.keyDraft")}
                    </div>
                    <strong>{tr("polish.recoveryPhrase")}</strong>
                    <code className="recovery-phrase">{phrase}</code>
                    <p className="muted">{tr("polish.recoveryWarning")}</p>
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={saved}
                        disabled={busy}
                        onChange={(e) => setSaved(e.target.checked)}
                      />
                      {tr("polish.keySaved")}
                    </label>
                  </>
                ) : importing ? (
                  <label>
                    {tr("polish.secretKey")}
                    <input
                      type="password"
                      className="input"
                      value={importSecret}
                      autoComplete="off"
                      spellCheck={false}
                      disabled={busy || registered}
                      onChange={(e) => setImportSecret(e.target.value)}
                    />
                  </label>
                ) : (
                  <label>
                    {tr("polish.publicKey")}
                    <input
                      className="input"
                      value={publicInput}
                      disabled={busy}
                      onChange={(e) => setPublicInput(e.target.value)}
                      maxLength={64}
                    />
                  </label>
                )}
                <Button
                  variant="primary"
                  loading={busy}
                  disabled={
                    !name.trim() ||
                    (!phrase && !importSecret && !publicInput) ||
                    (!!phrase && !saved)
                  }
                  onClick={() => void enroll()}
                >
                  {tr(registered ? "polish.login" : "auth.register")}
                </Button>
              </div>
            </Panel>
          )}
          {keys.map((k) => (
            <Panel key={k.id} title={k.name}>
              <div className="col gap-3">
                <code style={{ overflowWrap: "anywhere" }}>{k.public_key}</code>
                <Button
                  perm="access.manage"
                  disabled={busy}
                  onClick={() =>
                    void control("identity.remove", { id: k.id })
                      .then(load)
                      .catch((e) => setError(authError(e)))
                  }
                >
                  {tr("polish.keyRevoke")}
                </Button>
              </div>
            </Panel>
          ))}
          {!canEnroll && checked && !native && (
            <Panel title={tr("auth.recover")}>
              <p>{tr("auth.accessExpired")}</p>
              <Link
                className="btn"
                to="/identity?recover=1"
                onClick={() => location.reload()}
              >
                {tr("auth.recover")}
              </Link>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
