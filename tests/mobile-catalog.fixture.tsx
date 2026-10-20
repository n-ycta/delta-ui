/** Real shell and catalog components with a deterministic, non-production host. */
import { createRoot } from "react-dom/client";
import { ApiProvider } from "../src/app/ApiContext";
import { MockCoreAdapter } from "../src/api/mock/MockCoreAdapter";
import type { CoreApi } from "../src/api";
import { installHostBridge } from "../src/host/contract";
import { useDock, useNowPlaying } from "../src/shell/state";
import { App } from "../src/App";
import catalog from "../app-catalog.json";
import "../src/ui/controls.css";
import "../src/styles/tokens.css";
import "../src/styles/base.css";
import "../src/styles/components.css";
const installed: typeof catalog = location.search.includes("installed=vector")
  ? catalog.filter((a) => a.id === "dev.delta.lifeos")
  : [];
(window as any).mobileFixture = {
  calls: [],
  dock: useDock,
  player: useNowPlaying,
};
installHostBridge({
  info: async () => ({
    kind: "android",
    version: "fixture",
    uiVersion: "fixture",
    bridgeVersion: "1.0.0",
    features: ["portable-apps"],
  }),
  call: async (request) => {
    (window as any).mobileFixture.calls.push(request);
    switch (request.capability) {
      case "host.apps_catalog":
        return catalog;
      case "host.apps_list":
        return [...installed];
      case "host.apps_install": {
        const item = catalog.find((item) => item.id === request.args?.id);
        if (!item) throw Error("unknown_app");
        installed.push(item);
        return item;
      }
      case "host.apps_launch":
        return { url: "https://media.invalid/index.html", grants: [] };
      default:
        throw Error("unsupported_fixture_capability");
    }
  },
});
const mock = new MockCoreAdapter();
const api = new Proxy(mock, {
  get(target, key) {
    if (key === "mode") return "http";
    if (key === "listPlugins") return async () => [];
    if (key === "info")
      return async () => ({
        ...(await target.info()),
        principal: { role: "owner", name: "fixture-owner", scopes: ["admin"] },
      });
    const value = Reflect.get(target, key);
    return typeof value === "function" ? value.bind(target) : value;
  },
}) as CoreApi;
createRoot(document.getElementById("root")!).render(
  <ApiProvider api={api}>
    <App />
  </ApiProvider>,
);
