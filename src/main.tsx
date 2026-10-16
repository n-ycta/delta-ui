import { tr } from './i18n';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import { createCoreApi } from './api';
import { ApiProvider } from './app/ApiContext';
import { App } from './App';
import { discoverHost } from './host/browser';
import { installHostBridge } from './host/contract';
import { NativeHome } from './host/NativeHome';

document.title = tr('runtime.appTitle');
async function boot() {
 const host = await discoverHost();
 if(host) installHostBridge(host);
 const root=createRoot(document.getElementById('root')!);
 if(host) { root.render(<StrictMode><NativeHome bridge={host}/></StrictMode>);return; }
 const api=createCoreApi();
 root.render(<StrictMode><ApiProvider api={api}><App /></ApiProvider></StrictMode>);
}
void boot().catch(() => { document.getElementById('root')!.textContent=tr('host.unavailable'); });
