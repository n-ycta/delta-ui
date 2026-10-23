import { useEffect, useRef, useState } from 'react';
import { RefreshCw } from '../ui/icons';
import { tr } from '../i18n';
import { Button, Panel, Switch } from '../ui/primitives';
import { hostBridge } from './contract';
import { megabytes, normalizeUpdatePrefs, updateErrorKey, type UpdatePrefs } from './updates';

interface Found { current: string; latest: string | null; available: boolean; size: number; metered: boolean }
interface Status { state: 'idle' | 'downloading' | 'ready' | 'failed'; received: number; total: number; version: string; error: string }

/** Android only: check GitHub Releases, download the verified APK, hand it to the system installer. */
export function NativeUpdate() {
  const host = hostBridge()!;
  const call = async (capability: string, args: Record<string, unknown> = {}) => await host.call({ capability, args }) as any;
  const [supported, setSupported] = useState(false);
  const [prefs, setPrefs] = useState<UpdatePrefs>(normalizeUpdatePrefs(undefined));
  const [found, setFound] = useState<Found | null>(null);
  const [status, setStatus] = useState<Status>({ state: 'idle', received: 0, total: 0, version: '', error: '' });
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  const fail = (e: unknown) => setMessage(tr(updateErrorKey(e)));
  const save = async (next: UpdatePrefs) => { setPrefs(next); await call('host.document_put', { namespace: 'preferences', key: 'updates', value: next }).catch(fail); };
  const poll = async () => {
    try {
      const s = await call('host.update_status') as Status;
      setStatus(s);
      if (s.state === 'downloading') timer.current = window.setTimeout(() => void poll(), 1000);
      else if (s.state === 'failed') setMessage(tr(updateErrorKey(s.error)));
    } catch (e) { fail(e); }
  };

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const info = await host.info();
        if (!live || !info.features.includes('app-update')) return;
        const docs = await call('host.document_list', { namespace: 'preferences' }) as any[];
        setPrefs(normalizeUpdatePrefs(docs.find((d) => d.id === 'updates')));
        setSupported(true);
        void poll();
      } catch { /* not an updatable host */ }
    })();
    return () => { live = false; window.clearTimeout(timer.current); };
  }, []);

  if (!supported) return null;
  const run = async (fn: () => Promise<void>) => { setBusy(true); setMessage(''); try { await fn(); } catch (e) { fail(e); } finally { setBusy(false); } };
  const check = () => run(async () => {
    const f = await call('host.update_check', { channel: prefs.channel }) as Found;
    setFound(f);
    await save({ ...prefs, lastCheck: Date.now() });
  });
  const download = (allowMetered = false) => run(async () => {
    if (!found?.latest) return;
    try { await call('host.update_download', { version: found.latest, channel: prefs.channel, allowMetered }); }
    catch (e) {
      if ((e as { code?: string })?.code === 'metered_consent_required' && window.confirm(tr('nativeUpdate.meteredConfirm', { size: megabytes(found.size) }))) return void (await download(true));
      throw e;
    }
    void poll();
  });
  const install = () => run(async () => { if (found?.latest) await call('host.update_install', { version: found.latest }); });

  const downloading = status.state === 'downloading';
  const pct = status.total > 0 ? Math.min(100, Math.round((status.received / status.total) * 100)) : 0;
  return (
    <Panel title={tr('nativeUpdate.title')} actions={<Button title={tr('nativeUpdate.check')} onClick={() => void check()} disabled={busy || downloading}><RefreshCw size={16} /></Button>}>
      <div className="col gap-3">
        <p className="muted">{tr('nativeUpdate.hint')}</p>
        <label className="row" style={{ justifyContent: 'space-between' }}>{tr('nativeUpdate.auto')}<Switch checked={prefs.enabled} onChange={(enabled) => void save({ ...prefs, enabled })} /></label>
        <label className="row" style={{ justifyContent: 'space-between' }}>{tr('nativeUpdate.channel')}
          <select className="input" value={prefs.channel} onChange={(e) => void save({ ...prefs, channel: e.target.value === 'pre' ? 'pre' : 'stable' })}>
            <option value="stable">{tr('nativeUpdate.stable')}</option>
            <option value="pre">{tr('nativeUpdate.pre')}</option>
          </select>
        </label>
        {message && <div className="banner err" role="alert">{message}</div>}
        {found && (found.available
          ? <p>{tr('nativeUpdate.available', { current: found.current, latest: found.latest ?? '', size: megabytes(found.size) })}</p>
          : <p className="muted">{tr('nativeUpdate.upToDate', { current: found.current })}</p>)}
        {downloading && <div className="col gap-1"><progress value={pct} max={100} aria-label={tr('nativeUpdate.downloading')} style={{ width: '100%' }} /><span className="muted">{tr('nativeUpdate.progress', { done: megabytes(status.received), total: megabytes(status.total) })}</span></div>}
        <div className="row gap-2">
          {found?.available && status.state !== 'ready' && <Button variant="primary" onClick={() => void download()} disabled={busy || downloading}>{tr('nativeUpdate.download')}</Button>}
          {status.state === 'ready' && found?.latest === status.version && <Button variant="primary" onClick={() => void install()} disabled={busy}>{tr('nativeUpdate.install')}</Button>}
        </div>
      </div>
    </Panel>
  );
}
