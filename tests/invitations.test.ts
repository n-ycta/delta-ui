import {test} from 'node:test';import assert from 'node:assert/strict';
import {parseInvitation} from '../src/host/invitations';
import {tr} from '../src/i18n';
const C='a1b2c3d4e5f60718293a4b5c6d7e8f9012a3';
const ok=(t:string,url:string)=>assert.deepEqual(parseInvitation(t),{url,code:C});
const bad=(t:string,msg=tr('native.invalidQr'))=>assert.throws(()=>parseInvitation(t),(e:any)=>e.message===msg,t.slice(0,60));

test('accepts every issued invitation format',()=>{
 ok(`delta://pair?url=https%3A%2F%2Fdelta.example&code=${C}`,'https://delta.example');
 ok(`DELTA://PAIR?URL=https%3A%2F%2Fdelta.example&CODE=${C}`,'https://delta.example');
 ok(`  \n delta:///pair?url=http%3A%2F%2F192.168.1.5%3A7700&code=${C}\n `,'http://192.168.1.5:7700');
 ok(`delta:pair?url=http%3A%2F%2F192.168.1.5%3A7700%2F&code=${C}`,'http://192.168.1.5:7700');
 ok(`delta://pair?url=192.168.1.5%3A7700&code=${C}`,'http://192.168.1.5:7700');
 ok(`delta join http://192.168.1.5:7700 ${C}`,'http://192.168.1.5:7700');
 ok(`\n  delta   join  http://192.168.1.5:7700/   ${C}  \n`,'http://192.168.1.5:7700');
 ok(`Run on the phone:\n$ delta join https://delta.example ${C}\nthanks`,'https://delta.example');
 ok(JSON.stringify({code:C,url:'http://hub.example:7700',expiresAt:123,command:`delta join http://hub.example:7700 ${C}`}),'http://hub.example:7700');
 ok(JSON.stringify({code:C,command:`delta join http://hub.example:1 ${C}`,expires_in:600,url:'http://hub.example:1'}),'http://hub.example:1');
});

test('loopback and unusable addresses get their own error',()=>{
 for(const u of ['http://127.0.0.1:17750','http://localhost:7700','http://0.0.0.0:7700','http://[::1]:7700','http://127.5.5.5','http://hub.example:0','localhost:7700'])
  bad(`delta://pair?url=${encodeURIComponent(u)}&code=${C}`,tr('native.unreachable'));
 bad(`delta join http://127.0.0.1:17750 ${C}`,tr('native.unreachable'));
 bad(JSON.stringify({code:C,url:'http://127.0.0.1:17750'}),tr('native.unreachable'));
});

test('rejects malformed, unsafe and foreign input',()=>{
 bad(`delta:///pair`);bad(`delta://pair?code=${C}`);bad('');bad('hello');
 bad(`delta://pair?url=${encodeURIComponent('http://u:p@hub.example')}&code=${C}`);
 bad(`delta://pair?url=${encodeURIComponent('http://hub.example/?x=1')}&code=${C}`);
 bad(`delta://pair?url=${encodeURIComponent('http://hub.example/#x')}&code=${C}`);
 bad(`delta://pair?url=${encodeURIComponent('ftp://hub.example')}&code=${C}`);
 bad('delta://pair?url=http%3A%2F%2Fhub.example&code=');
 bad(`delta://pair?url=http%3A%2F%2Fhub.example&code=${'a'.repeat(257)}`);
 bad(`delta://pair?url=http%3A%2F%2Fhub.example&code=${C}&pad=${'x'.repeat(2100)}`);
 bad(`https://web.example/#/join?code=${C}`);
 bad('{"url":"http://hub.example"}');bad('{not json');bad(`{"url":5,"code":"${C}"}`);
});
