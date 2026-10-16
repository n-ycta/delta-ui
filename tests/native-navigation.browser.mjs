import { chromium } from "playwright";
import assert from "node:assert/strict";
import { build } from "vite";
import { createServer } from "node:http";
const built = await build({
  configFile: false,
  logLevel: "silent",
  build: {
    write: false,
    minify: false,
    lib: {
      entry: "src/host/navigation.ts",
      formats: ["es"],
      fileName: "navigation",
    },
  },
});
const code = (Array.isArray(built) ? built[0] : built).output.find(
  (o) => o.type === "chunk",
).code;
const server = createServer((req, res) => {
  res.setHeader(
    "Content-Type",
    req.url === "/navigation.js" ? "text/javascript" : "text/html",
  );
  res.end(
    req.url === "/navigation.js"
      ? code
      : `<nav>${["dashboard", "plugins/media", "settings", "nodes"].map((r) => `<a href="#/${r}"><span>${r}</span></a>`).join("")}<a href="https://example.org/post"><span>external</span></a></nav><output></output><script type="module">import {installNativeLinkHandler} from '/navigation.js';window.opens=[];installNativeLinkHandler(document,async url=>opens.push(url));const render=()=>document.querySelector('output').textContent=location.hash;addEventListener('hashchange',render);window.ready=true;</script>`,
  );
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || chromium.executablePath(),
  args: ["--no-sandbox"],
});
try {
  for (const width of [390, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 850 } });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.waitForFunction(() => window.ready);
    for (const route of ["dashboard", "plugins/media", "settings", "nodes"]) {
      await page.locator("a span").getByText(route, { exact: true }).click();
      await page.waitForFunction(
        (r) => document.querySelector("output").textContent === "#/" + r,
        route,
      );
      assert.equal(await page.evaluate(() => opens.length), 0);
    }
    await page.goBack();
    await page.waitForFunction(
      () => document.querySelector("output").textContent === "#/settings",
    );
    await page.locator("a span").getByText("external", { exact: true }).click();
    assert.deepEqual(await page.evaluate(() => opens), [
      "https://example.org/post",
    ]);
    assert.equal(new URL(page.url()).hash, "#/settings");
    await page.close();
  }
  console.log("PASS: nested menu clicks, back and external open at 390/1440px");
} finally {
  await browser.close();
  server.close();
}
