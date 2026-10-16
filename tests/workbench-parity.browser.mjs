import { mkdir } from "node:fs/promises";
const output = process.env.DELTA_TEST_OUTPUT || "/data";
await mkdir(output, { recursive: true });
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
  for (const label of await p.locator('.delta-select-trigger > span').all()) {
    assert(await label.evaluate(e => e.scrollWidth <= e.clientWidth), 'refresh interval must fit without ellipsis');
  }
  await p.screenshot({ path: `${output}/workbench-parity-home.png` });
  const system = p.locator('.wb-system-surface').first();
  await system.evaluate(e => e.style.width = '650px');
  const menu = system.locator('.topbar .mobile-only');
  await menu.waitFor({state:'visible'});
  await menu.click();
  assert(await system.locator('.sidebar').evaluate(e => getComputedStyle(e).position === 'absolute'), 'narrow embedded Console must use its own mobile navigation');
  await system.locator('.overlay').click({position:{x:600,y:120}});
  await system.evaluate(e => e.style.width = '');
  for (const [path, name] of [
    ["/plugins", "plugins"],
    ["/nodes", "nodes"],
    ["/events", "events"],
    ["/dashboards", "dashboards"],
  ]) {
    await p.locator(`.sidebar a[href="${path}"]`).click();
    await p.waitForTimeout(850);
    console.log(name, await p.locator("h1").allTextContents());
    await p.screenshot({ path: `${output}/workbench-parity-${name}.png` });
    if (name === "nodes") {
      await p.locator("tr.clickable").first().click();
      await p.waitForTimeout(850);
      console.log("node tabs", await p.locator(".tabs").innerText());
      await p.screenshot({
        path: `${output}/workbench-parity-node-detail.png`,
      });
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
  await p.screenshot({ path: `${output}/workbench-parity-type.png` });
  await p.setViewportSize({ width: 390, height: 844 });
  await p.waitForTimeout(500);
  await p.screenshot({ path: `${output}/workbench-parity-mobile.png` });
  assert.equal(
    await p.evaluate(() => document.documentElement.scrollWidth),
    390,
  );
  await p
    .locator(".topbar > button[title]")
    .filter({ has: p.locator("svg") })
    .first()
    .click();
  await p.waitForTimeout(300);
  assert.equal(await p.locator(".wb").getAttribute("data-wb-theme"), "paper");
  assert.equal(
    await p.evaluate(() => document.documentElement.dataset.theme),
    "light",
  );
  await p.screenshot({ path: `${output}/workbench-parity-mobile-light.png` });
  assert.equal(
    await p
      .locator(".wb-console-actions")
      .evaluate((e) => getComputedStyle(e).position),
    "relative",
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS full Console routes, node tabs, dashboards and charts, desktop/mobile, no runtime errors",
  );
} finally {
  await b.close();
}
