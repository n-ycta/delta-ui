import { createServer } from "vite";
import { chromium } from "playwright";
import assert from "node:assert/strict";
const server = await createServer({
  server: { host: "127.0.0.1", port: 0 },
  plugins: [
    {
      name: "onboarding-fixture",
      configureServer(s) {
        s.middlewares.use("/__onboarding", async (req, res) => {
          res.setHeader("Content-Type", "text/html");
          res.end(
            await s.transformIndexHtml(
              "/__onboarding",
              '<!doctype html><html data-theme="dark"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/tests/onboarding.fixture.tsx"></script></body></html>',
            ),
          );
        });
      },
    },
  ],
});
await server.listen();
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || chromium.executablePath(),
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(
    `http://127.0.0.1:${server.httpServer.address().port}/__onboarding`,
  );
  await page.getByText("Set up Delta", { exact: true }).waitFor();
  assert.equal(await page.locator("#shell-ready").count(), 0);
  const create = page.getByRole("button", { name: "Create", exact: true });
  assert(await create.isDisabled());
  await page.locator("input.input").first().fill("Test owner");
  await page.getByRole("button", { name: "Generate", exact: true }).click();
  assert(await create.isDisabled());
  assert.equal(await page.locator("[data-recovery-secret]").count(),0);
  await page.getByRole("button",{name:"Show phrase",exact:true}).click();
  const phrase = await page.locator("[data-recovery-secret]").textContent();
  await page.getByRole("checkbox").check();
  await create.click();
  await page.locator("#shell-ready").waitFor();
  const calls = await page.evaluate(() => window.calls);
  const enroll = calls.find((c) => c.capability === "identity.enroll");
  assert.match(enroll.args.public_key, /^[a-f0-9]{64}$/);
  assert.equal(enroll.args.name, "Test owner");
  assert(!JSON.stringify(calls).includes(phrase));
  assert(
    !(await page.evaluate(
      (p) => Object.values(localStorage).some((v) => v.includes(p)),
      phrase,
    )),
  );
  await page.reload();
  await page.locator("#shell-ready").waitFor();
  assert(
    !(await page.evaluate(() =>
      calls.some((c) => c.capability === "identity.enroll"),
    )),
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: explicit setup, saved-phrase confirmation, public-key-only enrollment, persisted completion",
  );
  await page.close();
} finally {
  await browser.close();
  await server.close();
}
