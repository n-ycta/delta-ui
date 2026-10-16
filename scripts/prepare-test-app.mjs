import {readFile} from 'node:fs/promises';import {installed,install,MAX_PACKAGE} from './app-runtime.mjs';
const [app]=JSON.parse(await readFile('app-catalog.json','utf8'));
if(!(await installed('.test-apps')).includes(app.id)){const response=await fetch(app.asset,{signal:AbortSignal.timeout(120000)});if(!response.ok)throw Error('Release download failed');const parts=[];let total=0;for await(const b of response.body){total+=b.length;if(total>MAX_PACKAGE)throw Error('package_limit');parts.push(b)}await install('.test-apps',Buffer.concat(parts),app)}
console.log('Installed verified app for integration tests');
