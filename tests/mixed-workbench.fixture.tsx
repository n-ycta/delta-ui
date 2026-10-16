import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import { createRoot } from "react-dom/client";
import { StrictMode } from "react";
import { installHostBridge } from "../src/host/contract";
import { ApiProvider } from "../src/app/ApiContext";
import { MockCoreAdapter } from "../src/api/mock/MockCoreAdapter";
import { enableStandaloneDemo } from "../src/api";
import { LiveWorkbench } from "../src/workbench/LiveWorkbench";
import { useRuntimeAccess } from "../src/app/stores";
const media = {
  id: "dev.delta.media",
  ui: {
    version: 1,
    surfaces: [
      {
        id: "radio",
        name: { en: "Radio" },
        icon: "broadcast",
        kind: "page",
        minWidth: 320,
        minHeight: 240,
        instance: "shared",
        requires: ["dev.delta.media >=0.1.0-alpha.3"],
      },
    ],
  },
};
import "../src/styles/tokens.css";
import "../src/styles/base.css";
import "../src/styles/components.css";
import "../src/ui/controls.css";
enableStandaloneDemo();
useRuntimeAccess
  .getState()
  .set({ role: "owner", name: "composition-test", scopes: ["admin"] });
installHostBridge({
  info: async () => ({
    kind: "android",
    version: "test",
    uiVersion: "test",
    bridgeVersion: "1.0.0",
    features: [],
  }),
  call: async (r) => {
    if (r.capability === "host.apps_launch")
      return { url: "http://127.0.0.1:5193/index.html" };
    if (r.capability === "host.apps_list")
      return [{ ...media, name: "Delta Media" }];
    throw Error("forbidden");
  },
});
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ApiProvider api={new MockCoreAdapter()}>
      <LiveWorkbench />
    </ApiProvider>
  </StrictMode>,
);
