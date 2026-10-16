import { chromium } from "playwright";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/local/bin/chromium",
  args: ["--no-sandbox", "--autoplay-policy=no-user-gesture-required"],
});
try {
  const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    }),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:5190/tests/media-surfaces.fixture.html");
  const f = page.frameLocator("iframe");
  await f.locator(".radio-card").first().waitFor();
  const frame = page.frames().find((f) => f.url().includes("5193"));
  const src = await page.locator("iframe").getAttribute("src");
  await f.locator("[data-action=radio-tracks]").first().click();
  await f.locator("[data-action=play]").first().waitFor({ timeout: 30000 });
  await f.locator("[data-action=play]").first().click();
  await page.waitForTimeout(3500);
  const before = await frame.evaluate(
    () => document.querySelector("#media").currentTime,
  );
  assert(before > 0);
  await page.locator("#queue").click();
  await page.waitForTimeout(500);
  assert(await f.locator("h1").innerText().then(s=>/queue|очередь/i.test(s)));
  assert.equal(await page.locator("iframe").getAttribute("src"), src);
  assert.equal(
    page.frames().find((f) => f.url().includes("5193")),
    frame,
  );
  const after = await frame.evaluate(
    () => document.querySelector("#media").currentTime,
  );
  assert(after > before);
  await page.locator("#theme").click();
  await page.waitForTimeout(200);
  assert.equal(
    await frame.evaluate(() => document.documentElement.dataset.theme),
    "dark",
  );
  await frame.evaluate(() =>
    window.postMessage(
      {
        type: "delta:presentation",
        channel: "forged",
        context: { surface: "settings" },
      },
      location.origin,
    ),
  );
  await page.waitForTimeout(100);
  assert.equal(await f.locator(".settings-grid").count(), 0);
  await page.locator("#radio").click();
  await f.locator("[data-action=radio-back]").waitFor();
  await f.locator("[data-action=radio-back]").click();
  await f.locator(".radio-card").first().waitFor();
  await page.screenshot({ path: "/data/media-embedded-surfaces.png" });
  assert.deepEqual(errors, []);
  console.log(
    "PASS real embedded Media: shared iframe, uninterrupted playback, surface switch, theme, forged message ignored",
  );
} finally {
  await browser.close();
}
