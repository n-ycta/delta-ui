import { createServer as viteServer } from "vite";
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { resolve, extname } from "node:path";
import assert from "node:assert/strict";
import { chromium } from "playwright";
const root = resolve(
  process.env.DELTA_MEDIA_DIST || ".test-apps/dev.delta.media",
);
const output = process.env.DELTA_TEST_OUTPUT || ".test-artifacts";
await mkdir(output, { recursive: true });
const appServer = createServer(async (req, res) => {
  try {
    const file = resolve(
      root,
      "." + new URL(req.url, "http://localhost").pathname,
    );
    if (!file.startsWith(root + "/")) throw Error();
    const b = await readFile(file);
    res.setHeader(
      "content-type",
      {
        ".js": "text/javascript",
        ".css": "text/css",
        ".html": "text/html",
        ".woff2": "font/woff2",
        ".svg": "image/svg+xml",
      }[extname(file)] || "application/octet-stream",
    );
    res.end(b);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((r) => appServer.listen(0, "127.0.0.1", r));
const server = await viteServer({
  server: { host: "127.0.0.1", port: 0 },
  plugins: [
    {
      name: "app-fixture",
      configureServer(s) {
        s.middlewares.use("/__app", async (req, res) => {
          res.setHeader("content-type", "text/html");
          res.end(
            await s.transformIndexHtml(
              "/__app",
              `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script>window.appURL='http://localhost:${appServer.address().port}/index.html'</script><script type="module" src="/tests/app.fixture.tsx"></script></body></html>`,
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
  for (const width of [390, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 850 } });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(() => {
      window.addEventListener("message", (e) => {
        if (e.data?.type === "delta:initialize")
          window.testChannel = e.data.channel;
      });
      localStorage.setItem("delta.language", "ru");
    });
    await page.goto(
      `http://127.0.0.1:${server.httpServer.address().port}/__app#/apps/dev.delta.media`,
    );
    const frame = page.frameLocator("iframe");
    await frame
      .getByRole("button", { name: "Медиатека", exact: false })
      .waitFor();
    const iframe = page.frames().find((f) => f.url().includes("/index.html?"));
    assert(iframe);
    assert.notEqual(new URL(page.url()).origin, new URL(iframe.url()).origin);
    assert.equal(
      await iframe.evaluate(() => typeof window.__TAURI_INTERNALS__),
      "undefined",
    );
    assert.equal(
      await iframe.evaluate(() => {
        try {
          return parent.localStorage.getItem("root-secret");
        } catch {
          return "blocked";
        }
      }),
      "blocked",
    );
    const reply = await iframe.evaluate(
      () =>
        new Promise((resolve) => {
          const id = "forbidden-probe";
          const listener = (e) => {
            if (e.data?.id === id) {
              window.removeEventListener("message", listener);
              resolve(e.data);
            }
          };
          window.addEventListener("message", listener);
          parent.postMessage(
            {
              channel: window.testChannel,
              id,
              request: { capability: "identity.list" },
            },
            new URL(location.href).searchParams.get("parentOrigin"),
          );
        }),
    );
    assert.equal(reply.error.code, "forbidden");
    assert.deepEqual(
      (await page.evaluate(() => window.calls)).map((v) => v.capability),
      ["host.apps_launch"],
    );
    assert.deepEqual(errors, []);
    await page.screenshot({ path: `${output}/app-embedding-${width}.png` });
    await page.close();
  }
  console.log(
    "PASS: real Media embedded through SDK, isolated storage and denied root capability at 390/1440px",
  );
} finally {
  await browser.close();
  await server.close();
  appServer.close();
}
