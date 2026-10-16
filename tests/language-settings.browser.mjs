import { createServer } from 'vite';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const server = await createServer({server:{host:'127.0.0.1',port:0}});
await server.listen();
const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || chromium.executablePath(),args:['--no-sandbox']});
try {
  for (const width of [390,1440]) {
    const context = await browser.newContext({viewport:{width,height:850}});
    await context.addInitScript(() => {
      localStorage.setItem('delta.console.connection',JSON.stringify({mode:'mock',baseUrl:'/api'}));
    });
    const page = await context.newPage();
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/#/settings?tab=general`);
    const language=page.getByRole('combobox',{name:'Language',exact:true});
    await language.waitFor();
    assert.equal(await page.locator('.topbar select').count(),0);
    await language.selectOption('ru');
    await page.getByRole('combobox',{name:'Язык',exact:true}).waitFor();
    assert.equal(await page.getByRole('combobox',{name:'Язык',exact:true}).inputValue(),'ru');
    await page.reload();
    await page.getByRole('combobox',{name:'Язык',exact:true}).waitFor();
    assert.equal(await page.locator('.topbar select').count(),0);
    assert.equal(await page.evaluate(()=>localStorage.getItem('delta.language')),'ru');
    assert.deepEqual(errors,[]);
    await context.close();
  }
  console.log('PASS: language only in Settings, persisted after reload at 390/1440px');
} finally {await browser.close();await server.close();}
