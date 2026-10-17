import { mkdir } from "node:fs/promises";
const output = process.env.DELTA_TEST_OUTPUT || "/data";
await mkdir(output, { recursive: true });
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { writeFile, readFile } from "node:fs/promises";
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH || "/usr/local/bin/chromium",
  args: ["--no-sandbox", "--autoplay-policy=no-user-gesture-required"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } }),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
// Desktops are switched from the global Delta dock (v0.3.0), not a per-workbench nav.
const nav = (name) =>
  page.locator(".dx-dock").getByRole("button", { name, exact: true });
const top = (name) =>
  page.locator(".wb-topbar").getByRole("button", { name, exact: true });
const settings = () => top("Настройки").click();
const dialog = () => page.getByRole("dialog");
const close = () =>
  dialog().getByRole("button", { name: "Закрыть", exact: true }).click();
const state = () =>
  page.evaluate(() => JSON.parse(localStorage.getItem("delta.workbench.v1")));
try {
  await page.goto("http://127.0.0.1:5190/workbench.html");
  await page.waitForSelector(".wb");
  await page.waitForTimeout(500);
  assert.equal((await state()).apps.length, 3, "starter desktops: home, studio, canvas");
  assert.equal(await page.locator(".wb-nav").count(), 0, "no per-workbench nav");
  for (const name of ["Консоль", "Главная", "Студия", "Канвас"])
    assert.equal(await nav(name).count(), 1, `dock entry ${name}`);
  await nav("Канвас").click();
  await page
    .locator(".wb-app-surface:not([hidden]) textarea")
    .first()
    .fill("Persistent note — not in layout export");
  await page.waitForTimeout(500);
  let s = await state(),
    canvas = s.apps.find((a) => a.template === "canvas"),
    original = { ...canvas.root.rects[canvas.root.children[0].id] };
  const header = page.locator(".wb-app-surface:not([hidden]) .wb-window>header").first();
  const box = await header.boundingBox();
  await page.mouse.move(box.x + 100, box.y + 24);
  await page.mouse.down();
  await page.mouse.move(box.x + 180, box.y + 74, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(500);
  s = await state();
  canvas = s.apps.find((a) => a.template === "canvas");
  assert(canvas.root.rects[canvas.root.children[0].id].x > original.x + 60);
  assert(canvas.root.rects[canvas.root.children[0].id].y > original.y + 30);
  await page.reload();
  await page.waitForTimeout(400);
  assert.equal(
    await page.locator(".wb-app-surface:not([hidden]) textarea").first().inputValue(),
    "Persistent note — not in layout export",
  );
  // Real local audio stored in IndexedDB; no mock playback counters.
  const wav = Buffer.alloc(44 + 8000 * 2 * 30);
  wav.write("RIFF");
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(8000, 24);
  wav.writeUInt32LE(16000, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(wav.length - 44, 40);
  for (let i = 44; i < wav.length; i += 2)
    wav.writeInt16LE(
      Math.round(Math.sin((((i - 44) / 2) * 2 * Math.PI * 440) / 8000) * 5000),
      i,
    );
  await page
    .locator(".wb-app-surface:not([hidden]) .wb-localmedia input[type=file]")
    .setInputFiles({ name: "tone.wav", mimeType: "audio/wav", buffer: wav });
  await page.locator(".wb-app-surface:not([hidden])").getByRole("button", { name: "tone.wav" }).click();
  const video = page.locator(".wb-app-surface:not([hidden]) video").first();
  await video.evaluate((v) => v.play());
  await page.waitForTimeout(1200);
  assert((await video.evaluate((v) => v.currentTime)) > 0.5);
  await nav("Студия").click();
  await page.waitForTimeout(1000);
  await nav("Канвас").click();
  assert((await video.evaluate((v) => v.currentTime)) > 1.5);
  await video.evaluate((v) => v.pause());
  await page.screenshot({ path: `${output}/workbench-canvas-desktop.png` });
  // Full pool picker, safe export/import, duplicate and settings.
  await settings();
  await dialog().getByRole("button", { name: "Иконка", exact: true }).click();
  await dialog().getByRole("textbox", { name: "Поиск" }).fill("headphones");
  assert(
    await dialog()
      .getByRole("button", { name: "headphones", exact: true })
      .count(),
  );
  await dialog()
    .getByRole("button", { name: "headphones", exact: true })
    .click();
  await settings();
  const download = page.waitForEvent("download");
  await dialog().getByRole("button", { name: "Экспорт", exact: true }).click();
  const d = await download;
  await d.saveAs(`${output}/delta-workspace-tested.json`);
  const exported = await readFile(
    `${output}/delta-workspace-tested.json`,
    "utf8",
  );
  assert(!exported.includes("Persistent note"));
  assert(!exported.includes("base64"));
  await dialog()
    .getByRole("button", { name: "Дублировать", exact: true })
    .click();
  await page.waitForTimeout(400);
  assert.equal((await state()).apps.length, 4);
  await close();
  // Advanced composition creates a real split around a selected component.
  await nav("Студия").click();
  await top("Конструктор").click();
  await page
    .locator(".wb-inspector label")
    .filter({ hasText: "Уровень" })
    .locator("select")
    .selectOption("advanced");
  await page
    .locator(".wb-outline>button")
    .filter({ hasText: "Заметки" })
    .first()
    .click();
  await page
    .locator(".wb-inspector")
    .getByRole("button", { name: "Разделить", exact: true })
    .click();
  await page.waitForTimeout(400);
  s = await state();
  assert.equal(
    s.apps.find((a) => a.template === "studio").root.children[0].type,
    "split",
  );
  // Studio now opens its browser by default; explicitly select the MCP form under test.
  await page.locator(".wb-app-surface:not([hidden])").getByRole("tab", {name:"MCP",exact:true}).click();
  await page.locator(".wb-app-surface:not([hidden]) .wb-system-surface .grid-aside .panel").first().waitFor();
  assert(
    await page
      .locator(".wb-system-surface .grid-aside .panel")
      .first()
      .evaluate((e) => e.getBoundingClientRect().width > 300),
    "embedded MCP form must stack at pane width",
  );
  assert(
    await page
      .locator(".wb-system-surface .grid-aside .panel-head")
      .first()
      .evaluate((e) => e.getBoundingClientRect().height < 100),
    "panel heading must not collapse into vertical text",
  );
  await page.screenshot({ path: `${output}/workbench-builder-desktop.png` });
  await top("Готово").click();
  // Every starter desktop renders under the global theme.
  for (const [name, path] of [
    ["Главная", "home"],
    ["Студия", "studio"],
    ["Канвас", "canvas"],
  ]) {
    await nav(name).click();
    await page.screenshot({ path: `${output}/workbench-${path}-desktop.png` });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await nav("Главная").click();
  await page.screenshot({ path: `${output}/workbench-home-mobile.png` });
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth),
    390,
  );
  await nav("Канвас").click();
  await page.screenshot({ path: `${output}/workbench-canvas-mobile.png` });
  await top("Конструктор").click();
  await page.screenshot({ path: `${output}/workbench-builder-mobile.png` });
  await top("Готово").click();
  await settings();
  await page.screenshot({ path: `${output}/workbench-settings-mobile.png` });
  await page.keyboard.press("Escape");
  assert.equal(await dialog().count(), 0);
  // Import a previously exported configuration, without copying notes/media or credentials.
  await page.locator(".wb>input[type=file]").setInputFiles({
    name: "layout.json",
    mimeType: "application/json",
    buffer: Buffer.from(exported),
  });
  await page.waitForTimeout(500);
  assert.equal((await state()).apps.length, 3);
  // Corrupt import must leave current valid layout untouched.
  await page.locator(".wb>input[type=file]").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"version":99,"script":"alert(1)"}'),
  });
  await page.waitForTimeout(400);
  assert.equal((await state()).apps.length, 3);
  assert(await page.getByRole("alert").count());
  assert.deepEqual(errors, []);
  console.log(
    "PASS: persistence, real media, keepalive, drag, icon pool, export/import, composition, starter desktops via global dock, mobile, modal, invalid import",
  );
} catch (e) {
  await page.screenshot({ path: `${output}/workbench-failure.png` }).catch(() => {});
  throw e;
} finally {
  await browser.close();
}
