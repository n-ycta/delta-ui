/** Rename identity references only; preserve notes, widget IDs, surfaces and layout geometry. */
export function migrateLifeOSReferences<T>(input:T):T {
 const visit=(value:unknown,key=''):unknown=>{
  if(typeof value==='string'){
   if(['target','app','appId','pluginId','generatedFrom'].includes(key)&&value==='dev.delta.vector')return 'dev.delta.lifeos';
   if(key==='id'&&value==='gen_ui_dev.delta.vector')return 'gen_ui_dev.delta.lifeos';
   return value;
  }
  if(Array.isArray(value))return value.map(x=>visit(x));
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,visit(v,k)]));
  return value;
 };
 return visit(input) as T;
}
