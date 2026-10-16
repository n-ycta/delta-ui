import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  verify,
  digest,
  validPath,
  install,
  installed,
  asset,
} from "../scripts/app-runtime.mjs";
function fixture() {
  const b = Buffer.from("<h1>Media</h1>");
  const p = {
    format: "delta-app-v1",
    manifest: {
      id: "dev.delta.media",
      version: "1",
      entry: "index.html",
      runtime: { execution: "web" },
      grants: [],
    },
    files: [
      { path: "index.html", sha256: digest(b), data: b.toString("base64") },
    ],
  };
  const bytes = Buffer.from(JSON.stringify(p));
  return {
    p,
    bytes,
    expected: { id: "dev.delta.media", version: "1", sha256: digest(bytes) },
  };
}
test("package hash, app identity, grants and asset hashes are checked before writes", () => {
  const { p, bytes, expected } = fixture();
  assert.equal(verify(bytes, expected).files.length, 1);
  assert.throws(() => verify(bytes, { ...expected, sha256: "bad" }));
  for (const mutation of [
    () => (p.manifest.grants = ["admin"]),
    () => (p.files[0].sha256 = "bad"),
    () => (p.files[0].path = "../config.json"),
  ]) {
    mutation();
    const b = Buffer.from(JSON.stringify(p));
    assert.throws(() => verify(b, { ...expected, sha256: digest(b) }));
  }
});
test("path policy rejects traversal, absolute paths and platform escapes", () => {
  for (const p of [
    "/root",
    "../x",
    "x/../y",
    "x\\y",
    "x//y",
    "%2e%2e/x",
    "a:b",
    ".",
  ])
    assert.equal(validPath(p), false);
});
test("atomic install refuses overwrite and exposes only in-root assets", async () => {
  const root = await mkdtemp(join(tmpdir(), "delta-app-"));
  try {
    const { bytes, expected } = fixture();
    await install(root, bytes, expected);
    assert.deepEqual(await installed(root), ["dev.delta.media"]);
    await assert.rejects(install(root, bytes, expected));
    assert.match(
      await asset(root, "dev.delta.media", "index.html"),
      /index.html$/,
    );
    await assert.rejects(asset(root, "dev.delta.media", "../config.json"));
    await assert.rejects(
      asset(root, "dev.delta.media", ".delta-manifest.json"),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test("explicit package replacement validates first and preserves the old app on rejection", async () => {
  const { bytes, expected, p } = fixture();
  const root = await mkdtemp(join(tmpdir(), "delta-app-update-"));
  try {
    await install(root, bytes, expected);
    await assert.rejects(
      install(root, bytes, { ...expected, sha256: "bad" }, { replace: true }),
    );
    assert.equal(
      await (
        await import("node:fs/promises")
      ).readFile(await asset(root, expected.id, "index.html"), "utf8"),
      "<h1>Media</h1>",
    );
    p.manifest.version = "2";
    const html = Buffer.from("<h1>Updated</h1>");
    p.files = [
      {
        path: "index.html",
        sha256: digest(html),
        data: html.toString("base64"),
      },
    ];
    const next = Buffer.from(JSON.stringify(p));
    await install(
      root,
      next,
      { ...expected, version: "2", sha256: digest(next) },
      { replace: true },
    );
    assert.equal(
      await (
        await import("node:fs/promises")
      ).readFile(await asset(root, expected.id, "index.html"), "utf8"),
      "<h1>Updated</h1>",
    );
    assert.deepEqual(await installed(root), [expected.id]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
