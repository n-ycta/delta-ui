import {createRoot} from 'react-dom/client';
import {useState} from 'react';import {MemoryRouter} from 'react-router-dom';
import {ApiProvider} from '../src/app/ApiContext';
import {MockCoreAdapter} from '../src/api/mock/MockCoreAdapter';
import {installHostBridge} from '../src/host/contract';
import {Canvas} from '../src/workbench/Canvas';
import {WidgetEditor} from '../src/dashboards/WidgetEditor';
import {FrameHost,AppSlot} from '../src/shell/frames';
import type {WidgetConfig} from '../src/core/contracts';
import '../src/workbench/workbench.css';
import '../src/styles/tokens.css';import '../src/styles/base.css';import '../src/styles/components.css';import '../src/shell/shell.css';import '../src/ui/controls.css';
const api=new MockCoreAdapter();Object.defineProperty(api,'mode',{value:'live'});
installHostBridge({info:async()=>({kind:'web',version:'test',uiVersion:'test',bridgeVersion:'1.0.0',features:[]}),call:async r=>{
 if(r.capability==='host.apps_list')return [{id:'dev.delta.media',name:'Delta Media',version:'0.3.0',ui:{version:1,surfaces:['player','queue'].map(id=>({id,name:{en:id==='player'?'Player':'Queue',ru:id==='player'?'Плеер':'Очередь'},icon:'play-circle',kind:'panel',minWidth:280,minHeight:240,instance:'shared',requires:['dev.delta.media>=0.3.0']}))}}];
 if(r.capability==='host.apps_launch')return {url:'http://127.0.0.1:5193/index.html'};
 throw Error('forbidden');
}});
function CanvasFixture(){const [tree,setTree]=useState<any>({id:'test',type:'canvas',title:'Canvas',icon:'grid-four',camera:{x:0,y:0,zoom:1},children:[{id:'player',type:'view',kind:'plugin',target:'dev.delta.media',title:'Player',icon:'play-circle'},{id:'notes',type:'view',kind:'notes',title:'Notes',icon:'note-pencil'}],rects:{player:{x:24,y:24,w:560,h:400},notes:{x:320,y:130,w:500,h:300}}});return <ApiProvider api={api}><MemoryRouter><FrameHost><div className="wb" style={{height:'100vh',display:'flex',flexDirection:'column'}}><Canvas tree={tree} onChange={setTree} edit={false} onSelect={()=>{}} render={v=>v.id==='player'?<AppSlot id="dev.delta.media" surface="player"/>:<textarea aria-label="Notes" style={{width:'100%',height:'100%'}}/>}/></div></FrameHost></MemoryRouter></ApiProvider>}
function FramesFixture(){const [second,setSecond]=useState(false);return <ApiProvider api={api}><MemoryRouter><FrameHost><button id="switch-frame" onClick={()=>setSecond(v=>!v)}>Switch</button><div data-slot="first" hidden={second} style={{width:560,height:400}}><AppSlot id="dev.delta.media" surface="player"/></div>{second&&<div data-slot="second" style={{width:560,height:400}}><AppSlot id="dev.delta.media" surface="player"/></div>}</FrameHost></MemoryRouter></ApiProvider>}
function Fixture(){const [config,setConfig]=useState<WidgetConfig|null>(()=>JSON.parse(localStorage.getItem('test-widget')||'null'));return <ApiProvider api={api}><MemoryRouter><FrameHost>{config?<><output id="saved" hidden>{JSON.stringify(config)}</output><div style={{width:560,height:400}}><AppSlot id={String(config.display.app)} surface={String(config.display.surface)}/></div><div style={{width:560,height:300}}><AppSlot id="dev.delta.media" surface="queue"/></div></>:<WidgetEditor open initial={null} plugins={[]} range="6h" onClose={()=>{}} onSave={v=>{localStorage.setItem('test-widget',JSON.stringify(v));setConfig(v)}}/>}</FrameHost></MemoryRouter></ApiProvider>}
createRoot(document.getElementById('root')!).render(location.search.includes('frames')?<FramesFixture/>:location.search.includes('canvas')?<CanvasFixture/>:<Fixture/>);
