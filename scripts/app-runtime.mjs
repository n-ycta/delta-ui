import { createHash, randomBytes } from "node:crypto";
import {
  mkdir,
  writeFile,
  rename,
  rm,
  readFile,
  readdir,
  realpath,
  stat,
} from "node:fs/promises";
import { join, sep } from "node:path";
export const MAX_PACKAGE = 16 * 1024 * 1024;
export const digest = (b) => createHash("sha256").update(b).digest("hex");
export const validId = (id) =>
  typeof id === "string" &&
  id.length > 0 &&
  id.length < 100 &&
  id.split(".").every((v) => /^[a-z0-9-]+$/.test(v));
export const validPath = (p) =>
  typeof p === "string" &&
  p.length > 0 &&
  p.length < 240 &&
  p
    .split("/")
    .every((v) => /^[a-zA-Z0-9._-]+$/.test(v) && v !== "." && v !== "..");
export const protocol = (id) => "deltaapp-" + id.replaceAll(".", "-");
export const APP_CSP =
  "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' https: data: blob:; media-src 'self' https: blob:; worker-src 'self'; connect-src 'self' https: wss:; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src https://www.youtube-nocookie.com";
export function verify(bytes, expected) {
  if (bytes.length > MAX_PACKAGE || digest(bytes) !== expected.sha256)
    throw Error("package_integrity");
  const p = JSON.parse(bytes);
  const m = p.manifest;
  if (
    p.format !== "delta-app-v1" ||
    !validId(m?.id) ||
    m.id !== expected.id ||
    m.version !== expected.version ||
    m.runtime?.execution !== "web" ||
    m.entry !== "index.html" ||
    JSON.stringify(m.grants) !== "[]"
  )
    throw Error("manifest_mismatch");
  if (!Array.isArray(p.files) || !p.files.length || p.files.length > 1000)
    throw Error("file_limit");
  const seen = new Set();
  let total = 0;
  const files = p.files.map((f) => {
    if (!validPath(f.path) || seen.has(f.path)) throw Error("unsafe_path");
    seen.add(f.path);
    if (
      typeof f.data !== "string" ||
      f.data.length > 4 * 1024 * 1024 ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
        f.data,
      )
    )
      throw Error("invalid_base64");
    const bytes = Buffer.from(f.data, "base64");
    total += bytes.length;
    if (total > 12 * 1024 * 1024 || digest(bytes) !== f.sha256)
      throw Error("asset_integrity");
    return { path: f.path, bytes };
  });
  if (!seen.has("index.html")) throw Error("missing_entry");
  return { manifest: m, files };
}
export async function installed(root) {
  try {
    return (await readdir(root, { withFileTypes: true }))
      .filter((v) => v.isDirectory() && !v.isSymbolicLink() && validId(v.name))
      .map((v) => v.name);
  } catch (e) {
    if (e.code === "ENOENT") return [];
    throw e;
  }
}
export async function install(root, bytes, expected) {
  const p = verify(bytes, expected);
  await mkdir(root, { recursive: true, mode: 0o700 });
  if ((await installed(root)).includes(p.manifest.id))
    throw Error("already_installed");
  const stage = join(root, ".stage-" + randomBytes(12).toString("hex"));
  try {
    await mkdir(stage, { mode: 0o700 });
    for (const f of p.files) {
      const path = join(stage, f.path);
      await mkdir(join(path, ".."), { recursive: true });
      await writeFile(path, f.bytes, { flag: "wx", mode: 0o600 });
    }
    await writeFile(
      join(stage, ".delta-manifest.json"),
      JSON.stringify(p.manifest),
      { mode: 0o600 },
    );
    await rename(stage, join(root, p.manifest.id));
    return p.manifest;
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
}
export async function asset(root, id, path) {
  if (!validId(id) || !validPath(path) || path === ".delta-manifest.json")
    throw Error("invalid_path");
  const dir = await realpath(join(root, id)),
    file = await realpath(join(dir, path));
  if (!file.startsWith(dir + sep) || !(await stat(file)).isFile())
    throw Error("invalid_path");
  return file;
}
export const mime = (path) =>
  ({
    html: "text/html; charset=utf-8",
    js: "text/javascript",
    mjs: "text/javascript",
    css: "text/css",
    json: "application/json",
    svg: "image/svg+xml",
    woff2: "font/woff2",
    woff: "font/woff",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
  })[path.split(".").pop()] || "application/octet-stream";
