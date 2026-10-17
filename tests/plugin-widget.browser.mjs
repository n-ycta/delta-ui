import {chromium}from'playwright';import assert from'node:assert/strict';
const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/local/bin/chromium',args:['--no-sandbox']});
try{const p=await b.newPage({viewport:{width:1440,height:1000}}),errors=[];p.setDefaultTimeout(15000);p.setDefaultNavigationTimeout(15000);p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:5190/tests/plugin-widget.fixture.html');
await p.getByRole('button',{name:'Player',exact:true}).waitFor();await p.screenshot({path:'/data/widget-plugin-source.png'});
await p.getByRole('button',{name:'Player',exact:true}).click();await p.getByRole('button',{name:'Add',exact:true}).click();
const cfg=JSON.parse(await p.locator('#saved').textContent());assert.equal(cfg.type,'app');assert.equal(cfg.display.app,'dev.delta.media');assert.equal(cfg.display.surface,'player');
await p.locator('iframe').first().waitFor();await p.waitForFunction(()=>document.querySelectorAll('iframe').length===2);
assert.equal(await p.locator('iframe').count(),2);await p.reload();await p.waitForFunction(()=>document.querySelectorAll('iframe').length===2);assert.equal(JSON.parse(await p.locator('#saved').textContent()).display.surface,'player');
await p.frameLocator('iframe').first().locator('.player-surface').waitFor();
await p.screenshot({path:'/data/widget-plugin-panels.png'});
await p.locator('.dx-slot').first().evaluate(el=>{el.parentElement.style.transform='scale(.5)';el.parentElement.style.transformOrigin='top left'});
await p.waitForTimeout(120);
const overlay=p.locator('.dx-frame').first();assert.equal(await overlay.evaluate(el=>getComputedStyle(el).transform),'matrix(0.5, 0, 0, 0.5, 0, 0)');
assert.equal(await overlay.evaluate(el=>el.offsetWidth),560);
assert.deepEqual(errors,[]);console.log('PASS plugin UI in source picker; save and reload; two independently visible surfaces');
}finally{await b.close()}
