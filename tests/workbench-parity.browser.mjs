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
  await p.waitForSelector(".wb");
  // Console is an app since 0.3.0, but a desktop may still embed it full-size (older layouts).
  const consoleDesk = {
    version: 1,
    active: "11111111-1111-4111-8111-111111111111",
    apps: [
      {
        id: "11111111-1111-4111-8111-111111111111",
        name: "Консоль",
        icon: "terminal",
        template: "console",
        theme: "graphite",
        nav: "hidden",
        mobileNav: "hidden",
        chrome: false,
        brand: true,
        logo: true,
        gap: 8,
        radius: 12,
        accent: "#7155da",
        root: {
          id: "22222222-2222-4222-8222-222222222222",
          type: "view",
          kind: "system",
          target: "/console",
          title: "Консоль",
          icon: "terminal",
        },
      },
    ],
  };
  await p.locator(".wb>input[type=file]").setInputFiles({
    name: "console.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(consoleDesk)),
  });
  await p.waitForSelector(".wb .sidebar");
  await p.waitForTimeout(1400);
  assert((await p.locator(".widget").count()) > 0);
  for (const label of await p.locator(".delta-select-trigger > span").all()) {
    assert(
      await label.evaluate((e) => e.scrollWidth <= e.clientWidth),
      "refresh interval must fit without ellipsis",
    );
  }
  await p.screenshot({ path: `${output}/workbench-parity-home.png` });
  const system = p.locator(".wb-system-surface").first();
  await system.evaluate((e) => (e.style.width = "650px"));
  const menu = system.locator(".topbar .mobile-only");
  await menu.waitFor({ state: "visible" });
  await menu.click();
  assert(
    await system
      .locator(".sidebar")
      .evaluate((e) => getComputedStyle(e).position === "absolute"),
    "narrow embedded Console must use its own mobile navigation",
  );
  await system
    .locator(".shell")
    .evaluate((e) => (e.dataset.collapsed = "true"));
  assert(
    await system
      .locator(".sidebar .nav-item")
      .first()
      .evaluate((e) => e.getBoundingClientRect().width > 180),
    "narrow sidebar must not retain collapsed desktop rail sizing",
  );
  await system
    .locator(".shell")
    .evaluate((e) => (e.dataset.collapsed = "false"));
  await system.locator(".overlay").click({ position: { x: 600, y: 120 } });
  await system.evaluate((e) => (e.style.width = ""));
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
  const themeBefore = await p.evaluate(() => document.documentElement.dataset.theme);
  await p
    .locator(".topbar > button[title]")
    .filter({ has: p.locator("svg") })
    .first()
    .click();
  await p.waitForTimeout(300);
  // One global theme: the Console toggle flips the whole shell, desktops included.
  assert.notEqual(
    await p.evaluate(() => document.documentElement.dataset.theme),
    themeBefore,
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
} catch (e) {
  await p.screenshot({ path: `${output}/workbench-parity-failure.png` }).catch(() => {});
  throw e;
} finally {
  await b.close();
}
