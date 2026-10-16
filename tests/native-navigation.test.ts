import { test } from "node:test";
import assert from "node:assert/strict";
import { isExternalHttpLink } from "../src/host/navigation";
for (const root of [
  "http://tauri.localhost/",
  "https://tauri.localhost/",
  "tauri://localhost/index.html",
]) {
  test(`internal and external URL classification at ${root}`, () => {
    for (const href of [
      "#/settings",
      "#/plugins/media",
      "#/dashboard",
      root + "#/nodes",
    ])
      assert.equal(isExternalHttpLink(href, root), false);
    for (const href of [
      "https://example.org/post",
      "https://tauri.localhost.evil.invalid/",
      "https://tauri.localhost@evil.invalid/",
    ])
      assert.equal(isExternalHttpLink(href, root), true);
    assert.equal(isExternalHttpLink("javascript:alert(1)", root), false);
  });
}

test('malformed href never crashes the root click handler',()=>{assert.equal(isExternalHttpLink('http://','https://tauri.localhost/'),false)});
