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
test("media intents: one UI player, providers are headless", () => {
  const c = readCatalog(raw);
  assert.equal(c.length, raw.length);
  for (const intent of ["media.play", "media.enqueue"]) {
    const receivers = c.filter((a) => a.intents.receive.includes(intent)).map((a) => a.id);
    assert.deepEqual(receivers, ["dev.delta.media"]);
    const senders = c.filter((a) => a.intents.send.includes(intent)).map((a) => a.id).sort();
    assert.deepEqual(senders, []);
  }
  assert.equal(c.some((a) => ["dev.delta.youtube","dev.delta.soundcloud","dev.delta.spotify"].includes(a.id)),false);
});
test("catalog parsing drops malformed intent names and payloads stay plain JSON", () => {
  const [a] = readCatalog([{ id: "dev.x.app", intents: { send: ["media.play", "BAD", 3, "x"], receive: "media.play" } }]);
  assert.deepEqual(a.intents, { send: ["media.play"], receive: [] });
  assert.deepEqual(sanitizePayload({ url: "https://x", f: () => 1, d: undefined }), { url: "https://x" });
  assert.throws(() => sanitizePayload({ big: "x".repeat(70000) }), /payload_too_large/);
});

import {hasUiUpdate} from '../src/shell/plugin-updates';
test('a current process does not hide an older installed interface update',()=>{
 const catalog=[{id:'dev.delta.media',version:'0.3.3'}];
 assert.equal(hasUiUpdate('dev.delta.media',[{id:'dev.delta.media',version:'0.1.0'}],catalog),true);
 assert.equal(hasUiUpdate('dev.delta.media',[{id:'dev.delta.media',version:'0.3.3'}],catalog),false);
 assert.equal(hasUiUpdate('dev.delta.media',[],catalog),false);
});

import {readUiContributions} from '../src/sdk/surfaces';
test('LifeOS is in the install catalog with thirteen composable surfaces and no ambient grants',()=>{
 const lifeos=raw.find((a:any)=>a.id==='dev.delta.lifeos');
 assert(lifeos,'A GitHub release alone must not hide LifeOS from the install catalog');
 assert.equal(lifeos.icon,'squares-four');
 assert.equal(lifeos.runtime.execution,'web');
 assert.match(lifeos.asset,/\/delta-lifeos\/releases\/download\/v[^/]+\/delta-lifeos\.delta-app$/);
 assert.equal(readCatalog(raw).filter(a=>a.id===lifeos.id).length,1);
 const contribution=readUiContributions(lifeos);
 assert(contribution);
 assert.deepEqual(contribution.surfaces.map(s=>s.id),['today','capture','tasks','journal','calendar','practices','projects','skills','review','habits','planner','rewards','statistics']);
 assert(contribution.surfaces.every(s=>s.instance==='shared'));
 assert.deepEqual(lifeos.grants,[]);
});
