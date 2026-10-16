import {createServer} from 'vite';import {chromium} from 'playwright';import assert from 'node:assert/strict';import {mkdir} from 'node:fs/promises';
const server=await createServer({server:{host:'127.0.0.1',port:0},plugins:[{name:'recovery-fixture',configureServer(s){s.middlewares.use('/__secret',async(req,res)=>{res.setHeader('content-type','text/html');res.end(await s.transformIndexHtml('/__secret','<!doctype html><html data-theme="light"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/tests/recovery.fixture.tsx"></script></body></html>'))})}}]});await server.listen();
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||chromium.executablePath(),args:['--no-sandbox']});const origin='http://127.0.0.1:'+server.httpServer.address().port;await mkdir('.test-artifacts',{recursive:true});
try{
 for(const width of [390,1440]){
  const context=await browser.newContext({viewport:{width,height:900},permissions:['clipboard-read','clipboard-write']});await context.addInitScript(()=>localStorage.setItem('delta.console.connection',JSON.stringify({mode:'mock',baseUrl:'/api'})));
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/#/settings?tab=profile');await page.getByLabel('Name',{exact:true}).fill('Delta owner');await page.getByLabel('Nickname',{exact:true}).fill('delta_user');
  await page.locator('input[type=file]').setInputFiles({name:'avatar.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2I+QAAAAASUVORK5CYII=','base64')});
  await page.locator('.profile-preview img').waitFor();await page.getByRole('button',{name:'Save',exact:true}).click();await page.getByText('Profile saved',{exact:true}).waitFor();await page.reload();await page.getByLabel('Name',{exact:true}).waitFor();assert.equal(await page.getByLabel('Name',{exact:true}).inputValue(),'Delta owner');assert.equal(await page.getByLabel('Nickname',{exact:true}).inputValue(),'delta_user');assert.match(await page.locator('.profile-preview img').getAttribute('src'),/^data:image\/webp/);
  assert(!(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)));
  for(const theme of ['light','dark']){await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);await page.screenshot({path:`.test-artifacts/profile-${theme}-${width}.png`,animations:'disabled'});}
  await page.goto(origin+'/__secret');assert.equal(await page.locator('[data-recovery-secret]').count(),0);assert(!(await page.locator('body').innerText()).includes('fixture private words'));
  await page.getByRole('button',{name:'Copy phrase',exact:true}).click();assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),'fixture private words');
  const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Download Markdown',exact:true}).click();const download=await pending;assert.equal(download.suggestedFilename(),'delta-recovery.md');let text='';for await(const b of await download.createReadStream())text+=b.toString();assert(text.includes('fixture private words'));assert(text.includes('Unencrypted'));
  await page.getByRole('button',{name:'Show phrase',exact:true}).click();assert.equal(await page.locator('[data-recovery-secret]').innerText(),'fixture private words');await page.getByRole('button',{name:'Hide phrase',exact:true}).click();assert.equal(await page.locator('[data-recovery-secret]').count(),0);await page.screenshot({path:`.test-artifacts/seed-hidden-${width}.png`,animations:'disabled'});
  assert.deepEqual(errors,[]);await context.close();
 }
 console.log('PASS: profile name/nickname/avatar upload and persistence, light/dark 390/1440px; recovery phrase absent from hidden DOM; actual clipboard and Markdown download; show/hide.');
}finally{await browser.close();await server.close()}
