import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pluginChannel} from '../src/sdk/channel';
import {validateRequest} from '../src/host/contract';
const tick=()=>new Promise(r=>setTimeout(r,0));
function fixture(call=async(_request:unknown)=>({value:'ok'})) {
 const listeners=new Set<(event:MessageEvent)=>void>();
 const old=(globalThis as any).window;
 (globalThis as any).window={addEventListener:(_name:string,fn:any)=>listeners.add(fn),removeEventListener:(_name:string,fn:any)=>listeners.delete(fn)};
 const messages:any[]=[];const source={postMessage:(...args:any[])=>messages.push(args)}as unknown as Window;
 const broker=pluginChannel({source,origin:'https://plugin.invalid',grants:new Set(['demo.read']),call});
 const send=(changes:any={})=>{for(const fn of listeners)void fn({source,origin:'https://plugin.invalid',data:{id:'r',channel:broker.channel,request:{capability:'demo.read'}},...changes}as MessageEvent)};
 return {broker,send,messages,source,close(){broker.revoke();(globalThis as any).window=old}};
}
test('scoped plugin channel rejects wrong source, origin and nonce without calls',async()=>{let calls=0;const f=fixture(async()=>{calls++;return {value:'ok'}});try{f.send({source:{}});f.send({origin:'https://evil.invalid'});f.send({data:{channel:'wrong',id:'r',request:{capability:'demo.read'}}});await tick();assert.equal(calls,0);assert.equal(f.messages.length,0)}finally{f.close()}});
test('plugin channel never allows undeclared capability or routing to another node',async()=>{let calls=0;const f=fixture(async()=>{calls++;return {value:'ok'}});try{for(const request of [{capability:'tokens.create'},{capability:'demo.read',node:'vps'}])f.send({data:{channel:f.broker.channel,id:'r',request}});await tick();assert.equal(calls,0);assert.equal(f.messages.length,2);assert(f.messages.every(m=>m[0].error.code==='forbidden'))}finally{f.close()}});
test('revoked plugin cannot receive results of an in-flight call',async()=>{let release:(v:{value:string})=>void=()=>{};const f=fixture(()=>new Promise(r=>{release=r}));try{f.send();f.broker.revoke();release({value:'secret-not-delivered'});await tick();assert.equal(f.messages.length,0)}finally{f.close()}});
test('plugin channel limits concurrent calls and sanitizes internal errors',async()=>{const releases:Array<(v:{value:string})=>void>=[];const f=fixture(()=>new Promise(r=>releases.push(r)));try{for(let i=0;i<5;i++)f.send();await tick();assert.equal(releases.length,4);assert(f.messages.some(m=>m[0].error?.code==='busy'));for(const release of releases)release({value:'ok'});await tick()}finally{f.close()}});
test('bridge request refuses oversized payloads',()=>{assert.throws(()=>validateRequest({capability:'demo.read',args:{data:'x'.repeat(70000)}}),/invalid_request/)});

test('JS contract matches Rust capability segments and rejects an empty target',()=>{for(const request of [{capability:'core.Info'},{capability:'core..info'},{capability:'core.'+'a'.repeat(49)},{capability:'core.info',node:''}])assert.throws(()=>validateRequest(request),/invalid_request/)});
