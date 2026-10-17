import {useApi} from './app/ApiContext';
import type { ReactNode } from 'react';
import { HashRouter, Route, Routes, useLocation } from 'react-router-dom';
import { ConsoleRoutes } from './ConsoleRoutes';
import { LiveWorkbench } from './workbench/LiveWorkbench';
import { Shell } from './layout/Shell';
import { DeltaRoot } from './shell/DeltaRoot';
import { ErrorBoundary } from './dashboards/ErrorBoundary';
import { ErrorState } from './ui/states';
import { Button } from './ui/primitives';
import { tr } from './i18n';
export function App(){return <HashRouter><DeltaRoot><Shell><RouteBoundary><Routes><Route path="/workbench" element={<LiveWorkbench demo={useApi().mode==='mock'}/>}/><Route path="*" element={<ConsoleRoutes/>}/></Routes></RouteBoundary></Shell></DeltaRoot></HashRouter>}
/** Page-level crash isolation: a broken page never takes down the shell; navigating away resets it. */
function RouteBoundary({ children }: { children: ReactNode }) {
  const loc = useLocation();
  return (
    <ErrorBoundary resetKey={loc.pathname} fallback={(e, reset) => (
      <div className="page"><div className="panel"><ErrorState error={e} onRetry={reset} extra={<Button variant="ghost" onClick={() => { location.hash = '#/'; reset(); }}>{tr("App.s_ef1ad90b17")}</Button>} /></div></div>
    )}>{children}</ErrorBoundary>
  );
}
