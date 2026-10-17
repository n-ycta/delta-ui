import { useApi } from '../../app/ApiContext';
import { WIcon } from '../../workbench/Icon';
import { AppSlot } from '../../shell/frames';
import { useInstalledApps } from '../../shell/apps';
import { s } from '../../shell/strings';
import type { WidgetProps } from '../types';

/** An installed app inside a dashboard tile. Shares the app's single running frame. */
export function AppWidget({ config, ctx }: WidgetProps) {
  const live = useApi().mode !== 'mock';
  const apps = useInstalledApps(live);
  const id = typeof config.display.app === 'string' ? config.display.app : '';
  const surface = typeof config.display.surface === 'string' ? config.display.surface : '';
  const app = apps.find((a) => a.id === id);
  if (ctx.editing || !app) {
    const value = id ? id + (surface ? '#' + surface : '') : '';
    return (
      <div className="dx-widget-pick" onMouseDown={(e) => e.stopPropagation()}>
        <WIcon name={app?.icon || 'app-window'} size={28} />
        {apps.length ? (
          <select
            className="select"
            aria-label={s('widgetAppPick')}
            value={value}
            onChange={(e) => {
              const [a, sf = ''] = e.target.value.split('#');
              ctx.onDisplayChange({ app: a, surface: sf || undefined });
            }}
          >
            <option value="" disabled>{s('widgetAppPick')}</option>
            {apps.flatMap((a) => [
              <option key={a.id} value={a.id}>{a.name}</option>,
              ...a.surfaces.map((x) => (
                <option key={a.id + '#' + x.id} value={a.id + '#' + x.id}>{`${a.name} · ${x.name}`}</option>
              )),
            ])}
          </select>
        ) : (
          <span className="muted">{s('widgetAppNone')}</span>
        )}
      </div>
    );
  }
  return <AppSlot id={app.id} surface={surface || undefined} className="dx-widget-app" />;
}
