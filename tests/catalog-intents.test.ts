import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readCatalog } from "../src/shell/apps";
import { sanitizePayload } from "../src/shell/intents";
const raw = JSON.parse(readFileSync(new URL("../app-catalog.json", import.meta.url), "utf8"));
test("reviewed catalog: every asset is checksum-pinned and grant-free", () => {
  for (const a of raw) {
    assert.match(a.asset, /^https:\/\/github\.com\/n-ycta\/[^/]+\/releases\/download\/v[^/]+\/[^/]+\.delta-app$/);
    assert.match(a.sha256, /^[0-9a-f]{64}$/);
    assert.ok(a.asset.includes("/v" + a.version + "/"), a.id + " asset matches version");
    assert.deepEqual(a.grants, []);
  }
});
test("media intents: sources send, exactly one player receives", () => {
  const c = readCatalog(raw);
  assert.equal(c.length, raw.length);
  for (const intent of ["media.play", "media.enqueue"]) {
    const receivers = c.filter((a) => a.intents.receive.includes(intent)).map((a) => a.id);
    assert.deepEqual(receivers, ["dev.delta.media"]);
    const senders = c.filter((a) => a.intents.send.includes(intent)).map((a) => a.id).sort();
    assert.deepEqual(senders, ["dev.delta.soundcloud", "dev.delta.spotify", "dev.delta.youtube"]);
  }
  assert.equal(c.find((a) => a.id === "dev.delta.youtube")?.icon, "youtube-logo");
});
test("catalog parsing drops malformed intent names and payloads stay plain JSON", () => {
  const [a] = readCatalog([{ id: "dev.x.app", intents: { send: ["media.play", "BAD", 3, "x"], receive: "media.play" } }]);
  assert.deepEqual(a.intents, { send: ["media.play"], receive: [] });
  assert.deepEqual(sanitizePayload({ url: "https://x", f: () => 1, d: undefined }), { url: "https://x" });
  assert.throws(() => sanitizePayload({ big: "x".repeat(70000) }), /payload_too_large/);
});
