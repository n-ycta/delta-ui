/** Local integration harness. The proxy owns test credentials; the plugin receives none. */
import {createRoot}from'react-dom/client';import{installHostBridge}from'../src/host/contract';import{PluginSurface}from'../src/pages/plugins/PluginApp';
import'../src/styles/tokens.css';import'../src/styles/base.css';import'../src/styles/components.css';
installHostBridge({info:async()=>({kind:'web',version:'test',uiVersion:'test',bridgeVersion:'1.0.0',features:[]}),call:async r=>{
 if(r.capability==='host.apps_launch')return{url:'http://127.0.0.1:5193/index.html'};
 const response=await fetch('http://127.0.0.1:17740',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(r)});const j=await response.json();if(!response.ok)throw Error(j.code);return j;
}});
createRoot(document.getElementById('root')!).render(<div style={{height:'100vh'}}><PluginSurface id="dev.delta.media" inline/></div>);
