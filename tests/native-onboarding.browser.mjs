import { createServer } from "vite";
import { chromium } from "playwright";
import assert from "node:assert/strict";
import {mkdir} from "node:fs/promises";
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
  await page.getByRole('button',{name:'Set up separately',exact:true}).click();
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
  // Existing identity import is explicitly separate from creating a key.
  const imported = await browser.newPage({viewport:{width:390,height:844}});
  await imported.goto(page.url());
  await imported.getByRole('button',{name:'Use existing key',exact:true}).click();
  await imported.locator('input.input').first().fill('Existing owner');
  const secret='0'.repeat(63)+'1';
  await imported.locator('input[type=password]').fill(secret);
  await imported.getByRole('button',{name:'Use key',exact:true}).click();
  await imported.locator('#shell-ready').waitFor();
  const importedCalls=await imported.evaluate(()=>window.calls);
  assert.equal(importedCalls.find(c=>c.capability==='identity.enroll').args.public_key,'79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798');
  assert(!JSON.stringify(importedCalls).includes(secret));
  assert(!(await imported.evaluate(s=>Object.values(localStorage).some(v=>v.includes(s)),secret)));
  await imported.close();
  // Pair directly, no generated/imported personal key; failed join does not complete setup.
  const pair=await browser.newPage({viewport:{width:390,height:844}});
  await pair.goto(page.url());
  await pair.getByRole('button',{name:'Connect to existing Delta',exact:true}).click();
  await pair.getByLabel('Core URL',{exact:false}).count().catch(()=>0);
  const inputs=pair.locator('input.input');
  await inputs.nth(1).fill('https://delta.example');
  await inputs.nth(2).fill('invalid');
  await pair.getByRole('button',{name:'Join',exact:true}).click();
  await pair.getByRole('alert').waitFor();
  assert.equal(await pair.locator('#shell-ready').count(),0);
  assert(!(await pair.evaluate(()=>window.calls.some(c=>c.capability==='identity.enroll'))));
  await pair.evaluate(()=>localStorage.setItem('fixture.failCompletion','once'));
  await inputs.nth(2).fill('valid-test-invitation');
  await pair.getByRole('button',{name:'Join',exact:true}).click();
  await pair.getByText('Temporary profile write failure',{exact:true}).waitFor();
  await pair.getByRole('button',{name:'Continue',exact:true}).click();
  await pair.locator('#shell-ready').waitFor();
  const pairCalls=await pair.evaluate(()=>window.calls);
  assert.equal(pairCalls.filter(c=>c.capability==='peers.join').length,2); // invalid, then successful; no replay
  assert.equal(pairCalls.find(c=>c.capability==='peers.join').args.trust_admin,false);
  assert(!pairCalls.some(c=>c.capability==='identity.enroll'));
  assert.equal(await pair.evaluate(()=>localStorage.getItem('fixture.services')),'existing-node');
  await pair.reload();await pair.locator('#shell-ready').waitFor();
  await pair.close();
  // Deep-link invitation received while onboarding is open enters the connection screen.
  const linked=await browser.newPage({viewport:{width:390,height:844}});
  await linked.goto(page.url());await linked.getByRole('button',{name:'Connect to existing Delta',exact:true}).waitFor();
  await linked.evaluate(async()=>{const m=await import('/src/host/NativeConnection.tsx');m.acceptInvitation('delta://pair?url=https%3A%2F%2Fdelta.example&code=link-test')});
  await linked.locator('input[type=url]').waitFor();
  assert.equal(await linked.locator('input[type=url]').inputValue(),'https://delta.example');
  assert.equal(await linked.locator('input[type=password]').inputValue(),'link-test');
  await linked.close();
  // Capture initial/connection layouts with production design tokens, without credentials.
  const out=process.env.DELTA_TEST_OUTPUT||'/tmp/delta-onboarding-qa';await mkdir(out,{recursive:true});
  for(const width of [390,1440]){
    const visual=await browser.newPage({viewport:{width,height:1000}});
    await visual.addInitScript(()=>localStorage.setItem('delta.language','ru'));
    await visual.goto(page.url());await visual.getByRole('button',{name:'Подключить к существующей Delta',exact:true}).waitFor();
    assert(await visual.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await visual.screenshot({path:`${out}/choose-${width}.png`,fullPage:true});
    await visual.getByRole('button',{name:'Подключить к существующей Delta',exact:true}).click();
    assert(await visual.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await visual.screenshot({path:`${out}/connect-${width}.png`,fullPage:true});
    await visual.close();
  }
  console.log(
    "PASS: local setup, same-key import, direct pairing without new identity, failed join, one-time-code-safe retry, service-node selection, persistent completion, deep links and responsive layouts",
  );
  await page.close();
} finally {
  await browser.close();
  await server.close();
}
