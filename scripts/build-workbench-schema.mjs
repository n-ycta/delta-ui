import ts from "typescript";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
const src = readFileSync(
  new URL("../src/workbench/model.ts", import.meta.url),
  "utf8",
);
const output = ts.transpileModule(src, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2021,
    module: ts.ModuleKind.ES2022,
  },
}).outputText;
writeFileSync(
  new URL("../src/workbench/schema.mjs", import.meta.url),
  "// Generated from model.ts; SHA256 " +
    createHash("sha256").update(src).digest("hex") +
    "\n" +
    output,
);
