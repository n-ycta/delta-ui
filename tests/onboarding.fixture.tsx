import React from "react";
import { createRoot } from "react-dom/client";
import { installHostBridge } from "../src/host/contract";
import { NativeOnboarding } from "../src/host/NativeOnboarding";
import "../src/styles/tokens.css";
import "../src/styles/base.css";
import "../src/styles/components.css";
const keys = JSON.parse(localStorage.getItem("fixture.keys") || "[]"),
  prefs = JSON.parse(localStorage.getItem("fixture.prefs") || "[]");
(window as any).calls = [];
installHostBridge({
  info: async () => ({
    kind: "android",
    version: "test",
    bridgeVersion: "1.0.0",
    uiVersion: "test",
    features: [],
  }),
  call: async (request) => {
    (window as any).calls.push(request);
    switch (request.capability) {
      case "identity.list":
        return keys;
      case "host.document_list":
        return prefs;
      case "identity.enroll":
        keys.push({ id: "key", ...request.args });
        localStorage.setItem("fixture.keys", JSON.stringify(keys));
        return keys[0];
      case "host.document_put":
        prefs.push(request.args!.value);
        localStorage.setItem("fixture.prefs", JSON.stringify(prefs));
        return request.args!.value;
      default:
        throw Error("Unknown fixture capability");
    }
  },
});
createRoot(document.querySelector("#root")!).render(
  <NativeOnboarding>
    <main id="shell-ready">Ready</main>
  </NativeOnboarding>,
);
