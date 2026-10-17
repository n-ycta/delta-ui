import {readFile}from'node:fs/promises';import{createHash}from'node:crypto';import{createServer}from'node:http';
const app=JSON.parse(await readFile(new URL('../app-catalog.json',import.meta.url),'utf8')).find(a=>a.id==='dev.delta.media');
const response=await fetch(app.asset);if(!response.ok)throw Error('Fixture download failed');const bytes=Buffer.from(await response.arrayBuffer());if(createHash('sha256').update(bytes).digest('hex')!==app.sha256)throw Error('Fixture checksum mismatch');
const pkg=JSON.parse(bytes),files=new Map(pkg.files.map(f=>['/'+f.path,Buffer.from(f.data,'base64')]));
const types={'.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.html':'text/html','.woff2':'font/woff2','.woff':'font/woff'};
createServer((req,res)=>{const pathname=new URL(req.url,'http://localhost').pathname,file=files.get(pathname==='/'?'/index.html':pathname);res.writeHead(file?200:404,{'content-type':types[pathname.slice(pathname.lastIndexOf('.'))]||'application/octet-stream'});res.end(file||'');}).listen(5193,'127.0.0.1',()=>console.log('Verified Media fixture listening'));
