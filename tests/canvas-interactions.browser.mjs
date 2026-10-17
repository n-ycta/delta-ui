import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/local/bin/chromium', args: ['--no-sandbox'] });
try {
 const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
 const errors = []; page.on('pageerror', e => errors.push(e.message));
 await page.goto('http://127.0.0.1:5190/workbench.html');
 await page.waitForSelector('.wb'); await page.waitForTimeout(600);
 await page.locator('.dx-dock').getByRole('button', { name: 'Канвас', exact: true }).click();
 const canvas = page.locator('.wb-app-surface:not([hidden]) .wb-canvas');
 const box = await canvas.boundingBox();
 await page.mouse.click(box.x + box.width - 60, box.y + 120, { button: 'right' });
 await page.getByRole('menuitem', { name: 'Заметки', exact: true }).click();
 assert.equal(await canvas.locator('.wb-window').count(), 3);
 const edge = canvas.locator('.wb-window').first().locator('.edge-e');
 const old = await canvas.locator('.wb-window').first().boundingBox();
 const e = await edge.boundingBox();
 await page.mouse.move(e.x + e.width / 2, e.y + 80); await page.mouse.down();
 await page.mouse.move(e.x + e.width / 2 + 90, e.y + 80, { steps: 12 }); await page.mouse.up();
 const resized = await canvas.locator('.wb-window').first().boundingBox();
 assert(resized.width > old.width + 80, 'resize through east edge');
 await page.keyboard.press('Control+-');
 assert.equal(await canvas.locator('[data-zoom]').textContent(), '83%');
 await page.keyboard.press('Control+0');
 assert.equal(await canvas.locator('[data-zoom]').textContent(), '100%');
 await page.screenshot({ path: '/data/canvas-fixed.png' });
 // Hidden dock was horizontal inside a vertical fixed shell. Test real persisted setting.
 await page.evaluate(() => localStorage.setItem('delta.shell.dock', JSON.stringify({ version: 1, state: { position:'hidden', labels:false, size:'md', order:[], unpinned:[], showDesktops:true, showPlayer:true } })));
 await page.reload();
 const handle = page.locator('.dx-peek-handle');
 {
  await handle.click(); await page.waitForTimeout(250);
  const dock = page.locator('.dx-dock.peek'); await dock.waitFor();
  assert.equal(await dock.getAttribute('data-position'), 'left');
  const r = await dock.boundingBox();
  for(const b of await dock.locator('.dx-dock-tail button').all()) { const br = await b.boundingBox(); if(br) assert(br.x >= r.x && br.x+br.width <= r.x+r.width+1); }
  await page.screenshot({ path: '/data/hidden-dock-fixed.png' });
 }
 assert.deepEqual(errors, []); console.log('PASS: context menu, add, edge resize, zoom shortcuts, hidden dock, no runtime errors');
} finally { await browser.close(); }
