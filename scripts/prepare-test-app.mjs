import { readFile } from 'node:fs/promises';
import { installed, install, MAX_PACKAGE } from './app-runtime.mjs';
const [app] = JSON.parse(await readFile('app-catalog.json', 'utf8'));
let version;
try { version = JSON.parse(await readFile(`.test-apps/${app.id}/.delta-manifest.json`, 'utf8')).version; }
catch (error) { if (error.code !== 'ENOENT') throw error; }
if (version !== app.version) {
  const response = await fetch(app.asset, { signal: AbortSignal.timeout(120000) });
  if (!response.ok) throw Error('Release download failed');
  const parts = []; let total = 0;
  for await (const bytes of response.body) {
    total += bytes.length;
    if (total > MAX_PACKAGE) throw Error('package_limit');
    parts.push(bytes);
  }
  await install('.test-apps', Buffer.concat(parts), app, { replace: (await installed('.test-apps')).includes(app.id) });
}
console.log(`Installed verified ${app.id} ${app.version} for integration tests`);
