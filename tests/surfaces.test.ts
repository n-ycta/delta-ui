import test from "node:test";
import assert from "node:assert/strict";
import {
  readInstalledSurfaceApps,
  readUiContributions,
} from "../src/sdk/surfaces";
const surface = {
  id: "radio",
  name: { en: "Radio", ru: "Радио" },
  icon: "broadcast",
  kind: "page",
  minWidth: 320,
  minHeight: 240,
  instance: "shared",
  requires: ["dev.delta.media >=0.1.0-alpha.3"],
};
test("declarative surface metadata accepted without granting permissions", () => {
  const value = readUiContributions({
    ui: { version: 1, surfaces: [surface] },
  });
  assert.equal(value?.surfaces[0].id, "radio");
});
test("unknown executable fields, unsafe IDs and unsupported instance mode rejected", () => {
  for (const patch of [
    { url: "javascript:alert(1)" },
    { id: "../admin" },
    { instance: "independent" },
    { minWidth: 0 },
    { grants: ["admin"] },
  ])
    assert.equal(
      readUiContributions({
        ui: { version: 1, surfaces: [{ ...surface, ...patch }] },
      }),
      null,
    );
});
test("duplicate surfaces and missing metadata rejected", () => {
  assert.equal(
    readUiContributions({ ui: { version: 1, surfaces: [surface, surface] } }),
    null,
  );
  assert.equal(readUiContributions({}), null);
  assert.equal(readUiContributions(null), null);
});

test("host metadata decoding isolates malformed entries and duplicate app IDs", () => {
  const app = {
    id: "dev.delta.media",
    name: "Media",
    ui: { version: 1, surfaces: [surface] },
  };
  assert.equal(readInstalledSurfaceApps({ apps: [app] }).length, 0);
  assert.equal(
    readInstalledSurfaceApps([null, app, app, { ...app, id: "../admin" }])
      .length,
    1,
  );
});
