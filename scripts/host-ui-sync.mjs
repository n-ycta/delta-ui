#!/usr/bin/env node
/**
 * Re-pin a Delta host (delta-web, delta-desktop, delta-android) to a reviewed delta-ui commit.
 * Usage (from the host repo root): node node_modules/@delta/ui/scripts/host-ui-sync.mjs <40-hex sha>
 * Updates package.json/-lock, Cargo.toml/.lock, tauri.conf.json, manifest.json, bumps the patch
 * version and prepends release notes. Prints `changed=true|false` and `version=` (also to $GITHUB_OUTPUT).
 * No code from the new UI revision is executed here.
 */
import { readFileSync, writeFileSync, existsSync, appendFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
const sha = process.argv[2] || "";
if (!/^[0-9a-f]{40}$/.test(sha)) throw Error("usage: host-ui-sync.mjs <40-hex delta-ui sha>");
const out = (k, v) => {
  console.log(`${k}=${v}`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${k}=${v}\n`);
};
const read = (p) => readFileSync(p, "utf8");
const pkg = JSON.parse(read("package.json"));
const deps = pkg.dependencies?.["@delta/ui"] ? pkg.dependencies : pkg.devDependencies;
const current = (deps["@delta/ui"].match(/archive\/([0-9a-f]{40})\.tar\.gz/) || [])[1];
if (!current) throw Error("@delta/ui is not pinned to an archive commit");
if (current === sha) {
  out("changed", "false");
  out("version", pkg.version);
  process.exit(0);
}
const old = pkg.version;
const m = old.match(/^(\d+)\.(\d+)\.(\d+)$/);
if (!m) throw Error("unsupported version " + old);
const version = `${m[1]}.${m[2]}.${Number(m[3]) + 1}`;
deps["@delta/ui"] = `https://github.com/n-ycta/delta-ui/archive/${sha}.tar.gz`;
pkg.version = version;
writeFileSync("package.json", JSON.stringify(pkg, null, 2) + "\n");
execFileSync("npm", ["install", "--package-lock-only", "--ignore-scripts", "--no-audit", "--no-fund"], { stdio: "inherit", shell: process.platform === "win32" });
const replaceAll = (p, from, to) => existsSync(p) && writeFileSync(p, read(p).split(from).join(to));
if (existsSync("src-tauri/Cargo.toml")) {
  let toml = read("src-tauri/Cargo.toml");
  toml = toml.split(current).join(sha).replace(/^version\s*=\s*"[^"]+"/m, `version = "${version}"`);
  writeFileSync("src-tauri/Cargo.toml", toml);
  const name = (toml.match(/^name\s*=\s*"([^"]+)"/m) || [])[1];
  if (existsSync("src-tauri/Cargo.lock")) {
    let lock = read("src-tauri/Cargo.lock").split(current).join(sha);
    if (name) lock = lock.replace(new RegExp(`(name = "${name}"\\nversion = )"[^"]+"`), `$1"${version}"`);
    writeFileSync("src-tauri/Cargo.lock", lock);
  }
}
if (existsSync("src-tauri/tauri.conf.json")) {
  const conf = JSON.parse(read("src-tauri/tauri.conf.json"));
  conf.version = version;
  writeFileSync("src-tauri/tauri.conf.json", JSON.stringify(conf, null, 2) + "\n");
}
if (existsSync("manifest.json")) {
  const man = JSON.parse(read("manifest.json"));
  if (man.version === old) man.version = version;
  if (man.metadata?.ui?.version === old) man.metadata.ui.version = version;
  const ascii = (t) => t.replace(/[\u007f-\uffff]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
  writeFileSync("manifest.json", ascii(JSON.stringify(man, null, 2)) + "\n");
}
let uiVersion = sha.slice(0, 7), bullets = [];
try {
  const raw = (f) => execFileSync("curl", ["-fsSL", "--max-time", "30", `https://raw.githubusercontent.com/n-ycta/delta-ui/${sha}/${f}`], { encoding: "utf8" });
  uiVersion = JSON.parse(raw("package.json")).version + " (" + sha.slice(0, 7) + ")";
  const section = raw("CHANGELOG.md").split(/^## /m)[1] || "";
  bullets = section.split("\n").filter((l) => l.startsWith("- ")).slice(0, 12);
} catch {}
const notes = [`- Pin shared Delta UI ${uiVersion} automatically (ui-sync).`, ...bullets].join("\n");
if (existsSync("CHANGELOG.md") && /^## \[v/m.test(read("CHANGELOG.md")))
  writeFileSync("CHANGELOG.md", `## [v${version}]\n\n${notes}\n\n` + read("CHANGELOG.md"));
if (existsSync("RELEASE.md") && /^## Version /m.test(read("RELEASE.md")))
  writeFileSync("RELEASE.md", `## Version ${version}\n\n${notes}\n- The platform limitations below remain unchanged.\n\n` + read("RELEASE.md"));
out("changed", "true");
out("version", version);
