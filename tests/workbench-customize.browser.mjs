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
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } }),
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
  await p.locator("[data-launcher-toggle]").click();
  await p
    .locator(".wb-recovery-dock")
    .getByRole("button", { name: "Настройки", exact: true })
    .click();
  const d = p.getByRole("dialog");
  const h = d.locator(".wb-home-options");
  await h.getByLabel("Заголовок", { exact: true }).fill("Моя станция");
  await h.locator("textarea").fill("Персональная панель Delta");
  await h.getByLabel("Сводка", { exact: true }).uncheck();
  await d.getByRole("button", { name: "Закрыть", exact: true }).click();
  await p.waitForTimeout(300);
  assert.equal(await p.locator("h1").innerText(), "Моя станция");
  assert.equal(await p.locator(".strip").count(), 0);
  await p.screenshot({ path: `${output}/workbench-custom-home.png` });
  await p.locator("[data-launcher-toggle]").click();
  await p
    .locator(".wb-recovery-dock")
    .getByRole("button", { name: "Настройки", exact: true })
    .click();
  await h.getByLabel("Приветствие", { exact: true }).uncheck();
  await h.getByLabel("Описание", { exact: true }).first().uncheck();
  await h.getByLabel("Дата", { exact: true }).uncheck();
  await d.getByRole("button", { name: "Закрыть", exact: true }).click();
  await p.waitForTimeout(250);
  assert.equal(await p.locator(".wb h1").count(), 0);
  assert((await p.locator(".widget").count()) > 0);
  const data = await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("delta.workbench.v1"));
    const db = JSON.parse(localStorage.getItem("delta.mock.db.v4"));
    const dash = db.dashboards.find((d) => d.origin === "home");
    const widget = dash.widgets.find((w) => w.type === "timeseries");
    const app = structuredClone(s.apps[0]);
    app.id = crypto.randomUUID();
    app.name = "Charts";
    app.template = "custom";
    app.chrome = true;
    app.nav = "side";
    const v = (target, title) => ({
      id: crypto.randomUUID(),
      type: "view",
      kind: "system",
      target,
      title,
      icon: "chart-line",
    });
    app.root = {
      id: crypto.randomUUID(),
      title: "Charts",
      icon: "chart-line",
      type: "split",
      axis: "row",
      ratio: 0.5,
      children: [
        v("/dashboards/" + dash.id + "/widgets/" + widget.id, "Chart"),
        v("/plugins", "Plugins"),
      ],
    };
    s.apps.push(app);
    s.active = app.id;
    return s;
  });
  await p.locator(".wb>input[type=file]").setInputFiles({
    name: "composed.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(data)),
  });
  await p.waitForSelector(".wb-existing-widget .recharts-wrapper");
  await p.waitForTimeout(600);
  assert(
    await p.getByRole("heading", { name: "Плагины", exact: true }).isVisible(),
  );
  await p.screenshot({
    path: `${output}/workbench-real-widget-composition.png`,
  });
  assert.deepEqual(errors, []);
  console.log(
    "PASS heading edits/hiding, summary removal, existing live widget + plugins composition",
  );
} catch (e) {
  await p.screenshot({ path: `${output}/workbench-customize-failure.png` }).catch(() => {});
  throw e;
} finally {
  await b.close();
}
