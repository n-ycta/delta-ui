/** Acceptance-only loopback transport. Every response comes from a disposable real Core/Web stack. */
import { createRoot } from "react-dom/client";
import { ApiProvider } from "../src/app/ApiContext";
import { createCoreApi } from "../src/api";
import { installHostBridge } from "../src/host/contract";
import { App } from "../src/App";
import "../src/ui/controls.css";
import "../src/styles/tokens.css";
import "../src/styles/base.css";
import "../src/styles/components.css";
installHostBridge({
  info: async () => ({
    kind: "web",
    version: "acceptance",
    uiVersion: "acceptance",
    bridgeVersion: "1.0.0",
    features: ["portable-apps"],
  }),
  call: async (request) => {
    const response = await fetch("/__accept/call", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
    });
    const value = await response.json();
    if (!response.ok)
      throw Object.assign(
        Error(value.message || value.error || "acceptance_call_failed"),
        { code: value.code || value.error },
      );
    return value;
  },
});
createRoot(document.getElementById("root")!).render(
  <ApiProvider api={createCoreApi()}>
    <App />
  </ApiProvider>,
);
