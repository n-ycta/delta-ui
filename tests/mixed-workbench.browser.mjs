import { chromium } from "playwright";
import assert from "node:assert/strict";
const b = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/local/bin/chromium",
  args: ["--no-sandbox", "--autoplay-policy=no-user-gesture-required"],
});
try {
  const p = await b.newPage({ viewport: { width: 1440, height: 1000 } }),
    errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto("http://127.0.0.1:5190/tests/mixed-workbench.fixture.html");
  await p.waitForSelector(".widget");
  await p.waitForTimeout(500);
  const data = await p.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("delta.workbench.v1")),
      db = JSON.parse(localStorage.getItem("delta.mock.db.v4"));
    const dashboard = db.dashboards.find((d) => d.origin === "home"),
      widget = dashboard.widgets.find((w) => w.type === "timeseries");
    const app = state.apps[0];
    Object.assign(app, {
      name: "Media + Analytics",
      chrome: true,
      nav: "dock",
      mobileNav: "dock",
      theme: "graphite",
    });
    app.root = {
      id: crypto.randomUUID(),
      title: "Media + Analytics",
      icon: "squares-four",
      type: "split",
      axis: "row",
      ratio: 0.55,
      children: [
        {
          id: crypto.randomUUID(),
          type: "view",
          kind: "plugin",
          target: "dev.delta.media#radio",
          title: "Radio",
          icon: "broadcast",
        },
        {
          id: crypto.randomUUID(),
          type: "view",
          kind: "system",
          target: `/dashboards/${dashboard.id}/widgets/${widget.id}`,
          title: "Typing",
          icon: "chart-line",
        },
      ],
    };
    return state;
  });
  await p.locator(".wb>input[type=file]").setInputFiles({
    name: "mixed.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(data)),
  });
  await p.waitForSelector(".wb-existing-widget .recharts-wrapper");
  const f = p.frameLocator("iframe");
  await f.locator(".radio-card").first().waitFor();
  assert.equal(await f.locator(".workspace").evaluate(e=>getComputedStyle(e).marginLeft),"0px");
  await f.locator("[data-action=radio-tracks]").first().click();
  await f.locator("[data-action=play]").first().waitFor({ timeout: 30000 });
  await f.locator("[data-action=play]").first().click();
  await p.waitForTimeout(2500);
  assert((await f.locator("#media").evaluate((e) => e.currentTime)) > 0);
  console.log(
    await p.evaluate(() =>
      [
        ".wb",
        ".wb-main",
        ".wb-stage",
        ".wb-app-surface",
        ".wb-tree-split",
        ".wb-split",
      ].map((s) => {
        const e = document.querySelector(s);
        return [
          s,
          e?.getBoundingClientRect().width,
          e && getComputedStyle(e).gridTemplateColumns,
        ];
      }),
    ),
  );
  await p.screenshot({
    path: "/data/workbench-mixed-media-statistics-desktop.png",
  });
  assert.equal(
    await p
      .locator(".wb-nav")
      .evaluate((e) => getComputedStyle(e).gridRowStart),
    "3",
  );
  await p.setViewportSize({ width: 390, height: 844 });
  await p.waitForTimeout(800);
  assert.equal(
    await p.evaluate(() => document.documentElement.scrollWidth),
    390,
  );
  await p.screenshot({
    path: "/data/workbench-mixed-media-statistics-mobile.png",
  });
  await p.locator(".wb-main").evaluate((e) => (e.scrollTop = e.scrollHeight));
  await p.screenshot({
    path: "/data/workbench-mixed-media-statistics-mobile-chart.png",
  });
  assert.deepEqual(errors, []);
  console.log(
    "PASS mixed real Media + original statistics widget, actual playback, dock, desktop/mobile",
  );
} finally {
  await b.close();
}
