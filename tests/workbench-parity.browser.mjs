import { chromium } from "playwright";
import assert from "node:assert/strict";
const b = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH || "/usr/local/bin/chromium",
  args: ["--no-sandbox"],
});
const p = await b.newPage({ viewport: { width: 1856, height: 1024 } }),
  errors = [];
p.on("pageerror", (e) => errors.push(e.message));
try {
  await p.goto("http://127.0.0.1:5190/workbench.html");
  await p.waitForSelector(".wb .sidebar");
  await p.waitForTimeout(1400);
  assert((await p.locator(".widget").count()) > 0);
  await p.screenshot({ path: "/data/workbench-parity-home.png" });
  for (const [path, name] of [
    ["/plugins", "plugins"],
    ["/nodes", "nodes"],
    ["/events", "events"],
    ["/dashboards", "dashboards"],
  ]) {
    await p.locator(`.sidebar a[href="${path}"]`).click();
    await p.waitForTimeout(850);
    console.log(name, await p.locator("h1").allTextContents());
    await p.screenshot({ path: `/data/workbench-parity-${name}.png` });
    if (name === "nodes") {
      await p.locator("tr.clickable").first().click();
      await p.waitForTimeout(850);
      console.log("node tabs", await p.locator(".tabs").innerText());
      await p.screenshot({ path: "/data/workbench-parity-node-detail.png" });
    }
  }
  const hrefs = await p
    .locator('a[href^="/dashboards/"]')
    .evaluateAll((els) =>
      els.map((e) => ({ href: e.getAttribute("href"), text: e.textContent })),
    );
  console.log(hrefs);
  const target =
    hrefs.find((x) => /набор|печат|type/i.test(x.text)) || hrefs[0];
  assert(target);
  await p.locator(`a[href="${target.href}"]`).first().click();
  await p.waitForTimeout(1200);
  assert((await p.locator(".widget").count()) > 0);
  assert((await p.locator(".recharts-wrapper").count()) > 0);
  await p.screenshot({ path: "/data/workbench-parity-type.png" });
  await p.setViewportSize({ width: 390, height: 844 });
  await p.waitForTimeout(500);
  await p.screenshot({ path: "/data/workbench-parity-mobile.png" });
  assert.equal(
    await p.evaluate(() => document.documentElement.scrollWidth),
    390,
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS full Console routes, node tabs, dashboards and charts, desktop/mobile, no runtime errors",
  );
} finally {
  await b.close();
}
