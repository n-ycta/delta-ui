import {createServer} from 'vite';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const server=await createServer({server:{host:'127.0.0.1',port:0},plugins:[{name:'pairing-fixture',configureServer(s){s.middlewares.use('/__pairing',async(req,res)=>{res.setHeader('Content-Type','text/html');res.end(await s.transformIndexHtml('/__pairing','<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/tests/pairing.fixture.tsx"></script></body></html>'))})}}]});
await server.listen();const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||chromium.executablePath(),args:['--no-sandbox']});const url=`http://127.0.0.1:${server.httpServer.address().port}/__pairing`,out=process.env.DELTA_TEST_OUTPUT||'/tmp/delta-pairing-qa';await mkdir(out,{recursive:true});
try{
 for(const width of [390,1440]){
  const p=await browser.newPage({viewport:{width,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto(url);await p.getByRole('button',{name:'Android phone or tablet',exact:true}).click();
  assert.equal(await p.locator('select').count(),0);
  assert.equal(await p.locator('input[type=url]').count(),1,'Android must not require a phone URL');
  await p.locator('input[type=url]').fill('https://delta.example:7700');
  await p.getByRole('button',{name:'Create invitation',exact:true}).click();
  await p.getByAltText('Invitation QR').waitFor();
  const link=await p.locator('input[readonly]').inputValue(),parsed=new URL(link);assert.equal(parsed.protocol,'delta:');assert.equal(parsed.searchParams.get('url'),'https://delta.example:7700');assert.equal(parsed.searchParams.get('code'),'fixture-one-time-code');
  const decoded=await p.evaluate(()=>window.decodeQr());assert.equal(decoded,link);
  assert.equal((await p.evaluate(()=>window.calls))[0].options.trustAdmin,true);
  assert.equal(await p.locator('pre').count(),0,'No Linux command in Android invitation');
  assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await p.screenshot({path:`${out}/android-${width}.png`,fullPage:true});
  await p.getByRole('button',{name:'New invitation',exact:true}).click();await p.getByRole('checkbox').check();await p.getByRole('button',{name:'Create invitation',exact:true}).click();
  assert.equal((await p.evaluate(()=>window.calls)).at(-1).options.trustAdmin,true);
  assert.deepEqual(errors,[]);await p.close();
 }
 const expired=await browser.newPage();await expired.goto(url+'?expired=1');await expired.getByRole('button',{name:'Android phone or tablet',exact:true}).click();await expired.locator('input[type=url]').fill('https://delta.example');await expired.getByRole('button',{name:'Create invitation',exact:true}).click();await expired.getByRole('alert').waitFor();assert(await expired.getByRole('button',{name:'Copy link',exact:true}).isDisabled());await expired.close();
 console.log('PASS: Android invitation requires no phone URL or desktop OS, decodable QR equals link, explicit admin grant, expiry, mobile/desktop layout');
}finally{await browser.close();await server.close()}
