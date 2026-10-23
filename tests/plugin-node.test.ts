import {test} from 'node:test';import assert from 'node:assert/strict';
import {pluginHostCall} from '../src/sdk/pluginApi';
const mk=(local:(c:string)=>any)=>{const calls:any[]=[];return{calls,host:{info:async()=>({kind:'android' as const,version:'t',bridgeVersion:'1.0.0',uiVersion:'t',features:[]}),call:async(r:any)=>{calls.push(r);if(r.capability==='peers.list')return[{node_id:'hub',online:true}];if(r.capability==='core.capabilities')return r.node==='hub'?[{name:'media.search'}]:[];if(r.node==='hub')return{from:'hub'};return local(r.capability)}}}};
test('a locally served capability makes exactly one host call and no lookups',async()=>{
 const {host,calls}=mk(()=>({from:'local'}));
 assert.deepEqual(await pluginHostCall(host,'lifeos.status',{a:1}),{from:'local'});
 assert.deepEqual(calls,[{capability:'lifeos.status',args:{a:1}}]);
});
test('not_found locally finds the peer once, then caches the decision for 60 s',async()=>{
 const {host,calls}=mk(()=>{throw {code:'not_found'}});
 assert.deepEqual(await pluginHostCall(host,'media.search',{},0),{from:'hub'});
 const n=calls.length;assert(calls.some(c=>c.capability==='peers.list'));
 await pluginHostCall(host,'media.search',{},59_000);assert.equal(calls.length,n+1);assert.equal(calls[calls.length-1].node,'hub');
 await pluginHostCall(host,'media.search',{},60_001);assert(calls.filter(c=>c.capability==='peers.list').length===2);
});
test('other errors are rethrown without peer lookup; unknown everywhere stays not_found',async()=>{
 const a=mk(()=>{throw {code:'forbidden'}});await assert.rejects(pluginHostCall(a.host,'x.y',{}),{code:'forbidden'});assert.equal(a.calls.length,1);
 const b=mk(()=>{throw {code:'not_found'}});await assert.rejects(pluginHostCall(b.host,'x.none',{},0),{code:'not_found'});
 const n=b.calls.length;await assert.rejects(pluginHostCall(b.host,'x.none',{},1000),{code:'not_found'});assert.equal(b.calls.length,n+1); // no new lookup within TTL
});
