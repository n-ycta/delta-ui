import {test} from 'node:test';import assert from 'node:assert/strict';
import {newerCatalogApps} from '../src/shell/appUpdates';
const ids=(c:any[],i:any[],f?:Set<string>)=>newerCatalogApps(c,i,f).map(x=>x.id);
test('auto-update only for strictly newer semver, never downgrades',()=>{
 assert.deepEqual(ids([{id:'a',version:'1.10.0'}],[{id:'a',version:'1.9.0'}]),['a']);
 assert.deepEqual(ids([{id:'a',version:'1.2.0'}],[{id:'a',version:'1.2.0'}]),[]);
 assert.deepEqual(ids([{id:'a',version:'1.2.0'}],[{id:'a',version:'1.3.0'}]),[]);
 assert.deepEqual(ids([{id:'a',version:'1.0.0'}],[{id:'a',version:'1.0.0-rc.1'}]),['a']);
 assert.deepEqual(ids([{id:'a',version:'weird'},{id:'b',version:'2.0.0'}],[{id:'a',version:'1.0.0'}]),[]);
 assert.deepEqual(ids([{id:'new',version:'1.0.0'}],[]),[]);
});
test('a failed id@version is not retried',()=>{assert.deepEqual(ids([{id:'a',version:'2.0.0'}],[{id:'a',version:'1.0.0'}],new Set(['a@2.0.0'])),[]);assert.deepEqual(ids([{id:'a',version:'2.0.1'}],[{id:'a',version:'1.0.0'}],new Set(['a@2.0.0'])),['a'])});
