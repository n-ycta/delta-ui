import { createServer } from 'vite';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const output = process.env.DELTA_TEST_OUTPUT || '.test-artifacts/mobile-catalog';
await mkdir(output,{recursive:true});
const server = await createServer({ server: {host:'127.0.0.1',port:0}, plugins:[{name:'mobile-catalog-fixture',configureServer(s){s.middlewares.use('/__mobile',async(req,res)=>{res.setHeader('content-type','text/html');res.end(await s.transformIndexHtml('/__mobile','<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/tests/mobile-catalog.fixture.tsx"></script></body></html>'));});}}] });
await server.listen();
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||chromium.executablePath(),args:['--no-sandbox']});
try {
 for (const width of [320,360,390,1440]) for (const language of ['en','ru']) for (const scheme of ['light','dark']) {
  const context=await browser.newContext({viewport:{width,height:width===320?640:844},hasTouch:width<760,isMobile:width<760,colorScheme:scheme});
  await context.addInitScript(({language,scheme})=>{localStorage.setItem('delta.language',language);localStorage.setItem('delta.mock.control',JSON.stringify({latencyMin:0,latencyMax:0,errorRate:0,liveEvents:false}));localStorage.setItem('delta.console.prefs',JSON.stringify({state:{theme:scheme},version:0}));},{language,scheme});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__mobile#/plugins?tab=available`);
  await page.locator('.plug').waitFor();await page.evaluate(()=>document.fonts.ready);
  const install=page.locator('.plug-actions .btn').first();
  await install.scrollIntoViewIfNeeded();
  const layout=await page.evaluate(()=>{
   const bounds=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}};
   const overflow=[...document.querySelectorAll('.dx-root,.dx-stage,.shell,.main,.content,.plugins-page,.catalog,.plug,.plugin-toolbar,.plugins-page>.tabs')].filter(e=>e.scrollWidth>e.clientWidth+1).map(e=>e.className);
   const icons=[...document.querySelectorAll('.plugin-toolbar .seg button')].map(e=>{const button=bounds(e),svg=bounds(e.querySelector('svg'));return{button,svg,dx:Math.abs(button.x+button.width/2-svg.x-svg.width/2),dy:Math.abs(button.y+button.height/2-svg.y-svg.height/2)}});
   const button=document.querySelector('.plug-actions .btn'),b=bounds(button),hit=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);
   return{overflow,icons,installHit:button===hit||button.contains(hit),bodyOverflow:document.documentElement.scrollWidth>innerWidth+1,dock:bounds(document.querySelector('.dx-dock')),install:b};
  });
  assert.deepEqual(layout.overflow,[],`${width}/${language}/${scheme} horizontal overflow`);assert(!layout.bodyOverflow);assert(layout.installHit,JSON.stringify(layout));
  for(const icon of layout.icons){assert(icon.dx<=1&&icon.dy<=1,`${width} icon not centered: ${JSON.stringify(icon)}`);if(width<760)assert(icon.button.width>=44&&icon.button.height>=44,JSON.stringify(icon));}
  if(width<760){assert(layout.install.height>=44);assert(layout.install.bottom<=layout.dock.y+1);assert.equal(await page.locator('.main>.banner[role=note]').count(),0);}
  await page.locator('.content').evaluate(e=>e.scrollTop=0);
  await page.screenshot({path:`${output}/catalog-${width}-${language}-${scheme}.png`,animations:'disabled'});
  const viewButtons=page.locator('.plugin-toolbar .seg button');await viewButtons.nth(1).click();assert.equal(await viewButtons.nth(1).getAttribute('aria-pressed'),'true');await viewButtons.first().click();
  await install.click();await page.waitForFunction(()=>window.mobileFixture.calls.some(c=>c.capability==='host.apps_install'));
  await page.getByRole('tab',{name:language==='ru'?/^Установленные/:/^Installed/}).click();await page.locator('.plug-actions .btn').waitFor();
  const manager=page.locator('.dx-tool').first();await manager.click();await page.getByRole('dialog').waitFor();
  assert.equal(await page.getByRole('dialog').evaluate(e=>e.scrollWidth>e.clientWidth+1),false);
  if(width===320&&language==='ru')await page.screenshot({path:`${output}/manager-${width}-${language}-${scheme}.png`,animations:'disabled'});
  await page.keyboard.press('Escape');
  if(width===360&&language==='ru'){
   await page.evaluate(()=>window.mobileFixture.player.getState().report('dev.delta.media',{title:'Длинное название композиции для проверки мобильного плеера',subtitle:'Исполнитель',playing:true,canNext:true,canPrev:true}));
   await page.screenshot({path:`${output}/player-${width}-${language}-${scheme}.png`,animations:'disabled'});
   await page.evaluate(()=>window.mobileFixture.dock.getState().set({position:'hidden'}));await page.locator('.dx-peek-handle').click();await page.locator('.dx-dock.peek').waitFor();
   const peek=await page.locator('.dx-dock.peek').boundingBox();assert(peek.x>=0&&peek.x+peek.width<=width);await page.keyboard.press('Escape');
  }
  if(width===320&&language==='ru') {
   await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__mobile#/settings?tab=general`);
   await page.locator('.settings-content .panel').waitFor();
   await page.screenshot({path:`${output}/settings-${width}-${language}-${scheme}.png`,animations:'disabled'});
   const overflow=await page.locator('.settings-page').evaluate(e=>e.scrollWidth>e.clientWidth+1);assert.equal(overflow,false,'settings page overflow');
  }
  assert.deepEqual(errors,[]);await context.close();
 }
 console.log('PASS: actual shell/catalog at 320/360/390/1440, RU/EN, light/dark; zero horizontal overflow; centered view icons; real clicks for mock install, tabs and manager; mobile player and hidden-dock reveal.');
}finally{await browser.close();await server.close();}
