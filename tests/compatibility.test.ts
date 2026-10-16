import { test } from "node:test";
import assert from "node:assert/strict";
import { incompatibility } from "../src/core/lib/compatibility";
const node = {
  kind: "android",
  os: "Android",
  arch: "aarch64",
  agentVersion: "0.4.5",
  status: "online",
};
test("process plugins are not offered as Android compatible, including legacy manifests", () => {
  assert.equal(incompatibility({ targets: ["android"] }, node), "process");
  assert.equal(
    incompatibility({ targets: ["android"], execution: "process" }, node),
    "process",
  );
});
test("portable media UI may declare all devices independently of a Node.js backend", () => {
  assert.equal(
    incompatibility(
      {
        targets: ["android", "desktop"],
        execution: "web",
        platforms: ["android"],
        architectures: ["arm64"],
      },
      node,
    ),
    null,
  );
});
test("platform, architecture, offline and minimum version constraints are explicit", () => {
  assert.equal(
    incompatibility(
      { targets: ["android"], execution: "web", architectures: ["x64"] },
      node,
    ),
    "architecture",
  );
  assert.equal(
    incompatibility(
      { targets: ["android"], execution: "web", platforms: ["windows"] },
      node,
    ),
    "platform",
  );
  assert.equal(
    incompatibility(
      { targets: ["android"], execution: "web", minAgent: "0.5.0" },
      node,
    ),
    "version",
  );
  assert.equal(
    incompatibility(
      { targets: ["android"], execution: "web" },
      { ...node, status: "offline" },
    ),
    "offline",
  );
});
