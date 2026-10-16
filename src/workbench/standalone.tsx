import "../ui/controls.css";
import { enableStandaloneDemo } from "../api";
import React from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/ibm-plex-sans/latin-400.css";
import "@fontsource/ibm-plex-sans/cyrillic-400.css";
import "@fontsource/ibm-plex-sans/latin-500.css";
import "@fontsource/ibm-plex-sans/cyrillic-500.css";
import "@fontsource/ibm-plex-sans/latin-600.css";
import "@fontsource/ibm-plex-sans/cyrillic-600.css";
import "@fontsource/ibm-plex-mono/latin-400.css";
import { App } from "../App";
import { ApiProvider } from "../app/ApiContext";
import { MockCoreAdapter } from "../api/mock/MockCoreAdapter";
import { useRuntimeAccess } from "../app/stores";
import "../styles/tokens.css";
import "../styles/base.css";
import "../styles/components.css";
enableStandaloneDemo();
const api = new MockCoreAdapter();
useRuntimeAccess
  .getState()
  .set({ role: "owner", name: "demo", scopes: ["admin"] });
if (!location.hash) location.hash = "/workbench";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ApiProvider api={api}>
      <App />
    </ApiProvider>
  </React.StrictMode>,
);
