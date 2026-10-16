import { tr } from '../i18n';
import { useEffect, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { WifiOff, X } from '../ui/icons';
import { usePrefs, useUi, useRuntimeAccess } from '../app/stores';
import { useResolvedTheme } from '../app/theme';
import { useApi } from '../app/ApiContext';
import { useQuery } from '../app/query';
import { queryClient } from '../app/query';
import { Toasts } from '../ui/Toasts';
import { Button } from '../ui/primitives';
import { ROLE_LABEL } from '../core/contracts';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { CommandPalette } from './CommandPalette';
import { NotificationsPanel } from './Notifications';
import { RealtimeBridge } from './Realtime';

export function Shell({ children,embedded=false }: { children: ReactNode;embedded?:boolean }) {
  const route=useLocation().pathname;
  const appView=route.startsWith('/apps/')||route==='/workbench';
  const setupOwner=useRuntimeAccess(s=>s.name==='browser-owner');
  const prefs = usePrefs();
  const theme = useResolvedTheme();
  const ui = useUi();
  const api = useApi();
  const info = useQuery('info', a => a.info(), { refetchMs: 15000 });
  useEffect(() => {
    if (api.mode === 'mock') useRuntimeAccess.getState().set({ role: 'owner', name: tr('runtime.demoUser'), scopes: ['admin'] });
    else useRuntimeAccess.getState().set(info.data?.principal ?? { role: 'viewer', name: '', scopes: [] });
  }, [api.mode, info.data]);
  useEffect(() => {
    if(embedded)return;
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.density = prefs.density;
  }, [theme, prefs.density,embedded]);
  const authRequired = (info.error as {code?:string;status?:number}|undefined)?.code === 'unauthorized' || (info.error as {status?:number}|undefined)?.status === 401;
  const disconnected = ui.connection.state === 'closed' || ui.connection.state === 'reconnecting';
  if(appView)return <><RealtimeBridge />{children}<NotificationsPanel /><Toasts /></>;
  return (
    <div className="shell" data-collapsed={prefs.sidebarCollapsed} data-mobile-nav={ui.mobileNav}>
      {!embedded&&<RealtimeBridge />}
      <Sidebar />
      {ui.mobileNav && <div className="overlay mobile-only" style={{ zIndex: 54 }} onClick={() => ui.set({ mobileNav: false })} />}
      <div className="main">
        <Topbar />
        {api.mode === 'http' && !prefs.realNoticeHidden && <div className="banner info" role="note">
          <span className="grow">{tr('runtime.realNotice')}</span>
          <Button variant="ghost" size="sm" iconOnly aria-label={tr('runtime.dismissNotice')} title={tr('runtime.dismissNotice')} style={{ flexShrink: 0, color: 'inherit' }} onClick={() => prefs.set({ realNoticeHidden: true })}><X size={15} /></Button>
        </div>}
        {authRequired ? <div className="banner err" role="alert"><span className="grow">{tr("polish.sessionExpired")}</span><Link to="/identity" className="btn sm">{tr("polish.login")}</Link></div> : disconnected && (
          <div className="banner err" role="status">
            <WifiOff size={14} />
            <span className="grow">{ui.connection.state === 'reconnecting' ? tr("layout.Shell.s_315bc1ad23") : tr("layout.Shell.s_b3cbff7b29", { p0: (api.endpoint) })}</span>
            <Button size="sm" onClick={() => { queryClient.invalidate('plugins'); queryClient.invalidate('nodes'); queryClient.invalidate('metric'); queryClient.invalidate('dashboards'); }}>{tr("layout.Shell.s_9e506acb19")}</Button>
            <Link to="/settings?tab=connection" className="btn sm ghost">{tr("layout.Shell.s_79e350f743")}</Link>
          </div>
        )}
        {prefs.viewAs && (
          <div className="banner info">
            <span className="grow">{tr("layout.Shell.s_a56e3d7306")}{ROLE_LABEL[prefs.viewAs]}{tr("layout.Shell.s_e40ed714e2")}</span>
            <Button size="sm" onClick={() => prefs.set({ viewAs: null })}>{tr("layout.Shell.s_4bb0c16e83")}</Button>
          </div>
        )}
        {setupOwner&&<div className="banner warn" role="status"><span className="grow">{tr('auth.setupSession')}</span><Link className="btn sm" to="/identity">{tr('auth.setupAction')}</Link></div>}
        <main className="content">{children}</main>
      </div>
      <CommandPalette />
      {!embedded&&<><NotificationsPanel /><Toasts /></>}
    </div>
  );
}
