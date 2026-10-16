"""Stage checksum-pinned, static app packages. No application code is executed."""
from pathlib import Path
import urllib.request,hashlib,json
catalog=json.loads(Path('node_modules/@delta/ui/app-catalog.json').read_text())
target=Path('app-packages');target.mkdir(exist_ok=True)
for app in catalog:
 url=app['asset'];assert url.startswith('https://github.com/n-ycta/') and '/releases/download/' in url
 with urllib.request.urlopen(url,timeout=120) as response:
  data=response.read(16*1024*1024+1)
 assert len(data)<=16*1024*1024 and hashlib.sha256(data).hexdigest()==app['sha256'],'App package checksum mismatch'
 path=target/(app['id']+'.delta-app');path.write_bytes(data)
print('Verified portable app packages:',len(catalog))
