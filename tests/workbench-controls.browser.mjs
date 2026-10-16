import { chromium } from "playwright";
import assert from "node:assert/strict";
const b = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/local/bin/chromium",
  args: ["--no-sandbox"],
});
try {
  const p = await b.newPage({ viewport: { width: 390, height: 844 } }),
    errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto("http://127.0.0.1:5190/workbench.html");
  await p.waitForSelector("[data-launcher-toggle]");
  const launcher = p.locator(".wb-control-launcher");
  assert.equal(await launcher.getAttribute("data-expanded"), "false");
  assert.equal(
    await launcher
      .getByRole("button", { name: "Настройки", exact: true })
      .count(),
    0,
  );
  await p.keyboard.press("Control+Shift+Space");
  await launcher
    .getByRole("button", { name: "Настройки", exact: true })
    .click();
  const d = p.getByRole("dialog");
  await d.getByLabel("Скрыть кнопку управления", { exact: true }).check();
  await d.getByRole("button", { name: "Закрыть", exact: true }).click();
  assert.equal(await p.locator("[data-launcher-toggle]").count(), 0);
  await p.keyboard.press("Control+Shift+Space");
  await launcher
    .getByRole("button", { name: "Настройки", exact: true })
    .click();
  await d.getByLabel("Скрыть кнопку управления", { exact: true }).uncheck();
  await d.getByRole("button", { name: "Закрыть", exact: true }).click();
  await p.reload();
  await p.waitForSelector("[data-launcher-toggle]");
  assert.equal(await launcher.getAttribute("data-expanded"), "false");
  await p.locator("[data-launcher-toggle]").click();
  await p.screenshot({
    path:
      (process.env.DELTA_TEST_OUTPUT || "/data") +
      "/workbench-controls-mobile.png",
  });
  await p.keyboard.press("Escape");
  assert.equal(await launcher.getAttribute("data-expanded"), "false");
  await p.keyboard.press("Control+Shift+e");
  await p.waitForSelector(".wb-edit");
  await p.keyboard.press("Control+Shift+e");
  assert.equal(await p.locator(".wb-edit").count(), 0);
  assert.deepEqual(errors, []);
  console.log(
    "PASS compact host controls, hidden launcher, hotkey recovery, persistence, Escape and editor shortcut",
  );
} finally {
  await b.close();
}
