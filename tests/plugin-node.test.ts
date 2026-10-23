import {test} from 'node:test';import assert from 'node:assert/strict';
import {installHostBridge} from '../src/host/contract';
import {pluginNode} from '../src/sdk/pluginApi';
const calls:any[]=[];
installHostBridge({info:async()=>({kind:'android',version:'t',bridgeVersion:'1.0.0',uiVersion:'t',features:[]}),call:async r=>{calls.push(r);if(r.capability==='peers.list')return[{node_id:'hub',online:true}];if(r.capability==='core.capabilities')return r.node==='hub'?[{name:'media.search'}]:[];return[]}});
test('pluginNode decides once per capability for 60 s, then re-checks',async()=>{
 assert.equal(await pluginNode('media.search',0),'hub');const n=calls.length;
 assert.equal(await pluginNode('media.search',59_000),'hub');assert.equal(calls.length,n);
 await Promise.all([pluginNode('media.other',0),pluginNode('media.other',1)]);const m=calls.length;
 assert.equal(calls.filter(c=>c.capability==='peers.list').length,2); // one per capability, concurrent calls share it
 assert.equal(await pluginNode('media.search',60_001),'hub');assert(calls.length>m);
});
