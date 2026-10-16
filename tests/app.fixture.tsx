import { createRoot } from "react-dom/client";
import { HashRouter, Routes, Route } from "react-router-dom";
import { installHostBridge } from "../src/host/contract";
import { PluginApp } from "../src/pages/plugins/PluginApp";
import "../src/styles/tokens.css";
import "../src/styles/base.css";
import "../src/styles/components.css";
(window as any).calls = [];
installHostBridge({
  info: async () => ({
    kind: "android",
    version: "test",
    uiVersion: "test",
    bridgeVersion: "1.0.0",
    features: [],
  }),
  call: async (r) => {
    (window as any).calls.push(r);
    if (r.capability === "host.apps_launch")
      return { url: (window as any).appURL, grants: [] };
    throw Error("forbidden");
  },
});
localStorage.setItem("root-secret", "owner-private-test");
createRoot(document.getElementById("root")!).render(
  <HashRouter>
    <Routes>
      <Route path="/apps/:id" element={<PluginApp />} />
    </Routes>
  </HashRouter>,
);
