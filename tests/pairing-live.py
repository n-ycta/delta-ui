"""Real two-Core pairing acceptance; DELTA_CORE_BINARY points to a verified Core binary.
No production profiles or credentials are used. This is not a physical Android/network test.
"""
import hashlib,json,os,secrets,socket,subprocess,tempfile,time,urllib.request,urllib.error
from pathlib import Path
binary=Path(os.environ['DELTA_CORE_BINARY']).resolve()
with tempfile.TemporaryDirectory(prefix='delta-pairing-') as d:
 nodes=[]
 def request(node,cap,args=None,target=None):
  body={'capability':cap,'args':args or {}}
  if target:body['node']=target
  req=urllib.request.Request(node['url']+'/v1/call',data=json.dumps(body).encode(),headers={'Authorization':'Bearer '+node['secret'],'Content-Type':'application/json'})
  try:
   with urllib.request.urlopen(req,timeout=20) as r:v=json.load(r)
  except urllib.error.HTTPError as e:v=json.load(e)
  return v
 def call(node,cap,args=None,target=None):
  v=request(node,cap,args,target);assert v.get('ok'),v.get('error');return v['result']
 def start(node):
  node['proc']=subprocess.Popen([str(binary),'run'],env={**os.environ,'DELTA_HOME':str(node['home'])},stdout=node['log'],stderr=node['log'])
  for _ in range(100):
   try:
    if call(node,'core.info')['node_id']==node['id']:return
   except (OSError,ValueError,AssertionError):time.sleep(.1)
  raise AssertionError('Test Core did not start')
 def stop(node):
  p=node.get('proc')
  if p and p.poll() is None:
   p.terminate()
   try:p.wait(timeout=15)
   except subprocess.TimeoutExpired:p.kill();p.wait()
 try:
  for kind in ['desktop','android']:
   home=Path(d)/kind;home.mkdir(mode=0o700)
   with socket.socket() as s:s.bind(('127.0.0.1',0));port=s.getsockname()[1]
   node={'id':secrets.token_hex(8),'home':home,'secret':secrets.token_hex(32),'url':f'http://127.0.0.1:{port}','log':open(home/'core.log','wb')}
   config={'node_id':node['id'],'name':'Acceptance '+kind,'node_kind':kind,'listen':'127.0.0.1','port':port,'url':node['url'],'tokens':[{'id':'test-owner','name':'test-owner','hash':hashlib.sha256(node['secret'].encode()).hexdigest(),'scopes':['admin']}]}
   (home/'config.json').write_text(json.dumps(config));(home/'config.json').chmod(0o600);nodes.append(node);start(node)
  hub,phone=nodes
  invite=call(hub,'peers.invite',{'trust_admin':False})
  joined=call(phone,'peers.join',{'url':hub['url'],'code':invite['code'],'trust_admin':False})
  assert joined['node_id']==hub['id']
  assert any(p['node_id']==phone['id'] for p in call(hub,'peers.list'))
  assert call(phone,'core.info',target=hub['id'])['node_id']==hub['id']
  assert call(hub,'core.info',target=phone['id'])['node_id']==phone['id']
  denied=request(phone,'tokens.list',target=hub['id']);assert not denied['ok'] and denied['error']['code']=='forbidden'
  reused=request(phone,'peers.join',{'url':hub['url'],'code':invite['code']});assert not reused['ok']
  assert call(phone,'identity.list')==[], 'Pairing must not require creating a personal key'
  stop(phone);start(phone)
  assert call(phone,'core.info',target=hub['id'])['node_id']==hub['id']
  assert any(p['node_id']==phone['id'] for p in call(hub,'peers.list'))
  print('PASS: real Core invitation, Android-kind peer registration, signed calls in both directions on a reachable network, single-use code, denied ungranted admin, no new personal key, persistence after restart')
 finally:
  for node in nodes:stop(node);node['log'].close()
