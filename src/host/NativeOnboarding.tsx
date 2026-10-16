import {RecoverySecret} from '../ui/RecoverySecret';
import { useEffect, useState, type ReactNode } from "react";
import { schnorr } from "@noble/curves/secp256k1";
import { bytesToHex } from "@noble/hashes/utils";
import { generateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english";
import { keyFromInput } from "../auth/key-login";
import { hostBridge } from "./contract";
import { pendingInvitation } from "./NativeConnection";
import { tr } from "../i18n";
import { Button, Panel } from "../ui/primitives";
/** Identity enrollment is explicit; the encrypted host bootstrap is not a user identity. */
export function NativeOnboarding({ children }: { children: ReactNode }) {
  const host = hostBridge()!;
  const [ready, setReady] = useState(false),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [name, setName] = useState(""),
    [secret, setSecret] = useState(""),
    [phrase, setPhrase] = useState(""),
    [saved, setSaved] = useState(false),
    [keys, setKeys] = useState<any[]>([]);
  async function check() {
    setError("");
    setLoading(true);
    try {
      const [prefs, identities] = (await Promise.all([
        host.call({
          capability: "host.document_list",
          args: { namespace: "preferences" },
        }),
        host.call({ capability: "identity.list" }),
      ])) as any[];
      setKeys(identities);
      setReady(
        identities.length > 0 &&
          prefs.some((v: any) => v.id === "onboarding" && v.version === 1),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void check();
  }, []);
  async function finish(enroll: boolean) {
    setBusy(true);
    setError("");
    try {
      if (enroll) {
        const key = keyFromInput(phrase || secret);
        try {
          await host.call({
            capability: "identity.enroll",
            args: {
              name: name.trim(),
              public_key: bytesToHex(schnorr.getPublicKey(key)),
              scopes: ["admin"],
            },
          });
        } finally {
          key.fill(0);
        }
        setSecret("");
        setPhrase("");
      }
      await host.call({
        capability: "host.document_put",
        args: {
          namespace: "preferences",
          key: "onboarding",
          value: { id: "onboarding", version: 1 },
        },
      });
      if (pendingInvitation) location.hash = "#/settings?tab=connection";
      setReady(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (ready) return <>{children}</>;
  return (
    <main className="auth-page">
      <div className="auth-card">
        <Panel title={tr("onboarding.title")}>
          <div className="col gap-3">
            <p className="muted">{tr("onboarding.description")}</p>
            {error && (
              <div className="banner err" role="alert">
                {error}
              </div>
            )}
            {loading ? (
              <p role="status">{tr("onboarding.loading")}</p>
            ) : (
              <>
                {keys.length > 0 && (
                  <>
                    <p>
                      {tr("onboarding.existing", {
                        names: keys.map((k) => k.name).join(", "),
                      })}
                    </p>
                    <Button disabled={busy} onClick={() => void finish(false)}>
                      {tr("onboarding.continue")}
                    </Button>
                  </>
                )}
                <label>
                  {tr("polish.identityName")}
                  <input
                    className="input"
                    value={name}
                    maxLength={80}
                    autoComplete="off"
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <Button
                  disabled={busy}
                  onClick={() => {
                    setPhrase(generateMnemonic(wordlist, 128));
                    setSecret("");
                    setSaved(false);
                  }}
                >
                  {tr("onboarding.generate")}
                </Button>
                {phrase ? (
                  <>
                    <RecoverySecret value={phrase}/>
                    <p>{tr("polish.recoveryWarning")}</p>
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={saved}
                        onChange={(e) => setSaved(e.target.checked)}
                      />
                      {tr("polish.keySaved")}
                    </label>
                  </>
                ) : (
                  <label>
                    {tr("polish.secretKey")}
                    <input
                      className="input"
                      type="password"
                      autoComplete="off"
                      spellCheck={false}
                      value={secret}
                      maxLength={2048}
                      onChange={(e) => setSecret(e.target.value)}
                    />
                  </label>
                )}
                <p className="muted">{tr("polish.keyPrivacy")}</p>
                <Button
                  variant="primary"
                  disabled={
                    busy ||
                    !name.trim() ||
                    (!phrase && !secret) ||
                    (!!phrase && !saved)
                  }
                  onClick={() => void finish(true)}
                >
                  {tr("onboarding.create")}
                </Button>
                <p className="muted">{tr("onboarding.pairing")}</p>
              </>
            )}
            <Button disabled={busy || loading} onClick={() => void check()}>
              {tr("auth.retry")}
            </Button>
          </div>
        </Panel>
      </div>
    </main>
  );
}
