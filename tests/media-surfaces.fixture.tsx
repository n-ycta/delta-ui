import { createRoot } from "react-dom/client";
import { useState } from "react";
import { installHostBridge } from "../src/host/contract";
import { PluginSurface } from "../src/pages/plugins/PluginApp";
import "../src/styles/tokens.css";
import "../src/styles/base.css";
import "../src/styles/components.css";
installHostBridge({
  info: async () => ({
    kind: "web",
    version: "test",
    uiVersion: "test",
    bridgeVersion: "1.0.0",
    features: [],
  }),
  call: async (r) => {
    if (r.capability === "host.apps_launch")
      return { url: "http://127.0.0.1:5193/index.html" };
    throw Error("forbidden");
  },
});
function Fixture() {
  const [surface, setSurface] = useState("radio"),
    [theme, setTheme] = useState<"light" | "dark">("light");
  return (
    <>
      <button id="queue" onClick={() => setSurface("queue")}>
        Queue
      </button>
      <button id="radio" onClick={() => setSurface("radio")}>
        Radio
      </button>
      <button id="theme" onClick={() => setTheme("dark")}>
        Theme
      </button>
      <PluginSurface
        id="dev.delta.media"
        surface={surface}
        themeOverride={theme}
        inline
      />
    </>
  );
}
createRoot(document.getElementById("root")!).render(<Fixture />);
