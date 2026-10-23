import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { hostBridge } from './contract';
import { acceptInvitation, pendingInvitation, takeInvitation, pairingAddress } from './invitations';
import { tr } from '../i18n';
import { Button } from '../ui/primitives';

function joinError(err: unknown) {
  const text = err instanceof Error ? err.message : String(err);
  if (/127\.0\.0\.1|localhost|this machine only/i.test(text)) return tr('native.unreachable');
  if (/invalid or expired/i.test(text)) return tr('native.expired');
  if (/error sending request|\/v1\/call|Failed to fetch|network/i.test(text)) return tr('native.cannotReach');
  return text || tr('native.cannotReach');
}

/** Explicit peer enrollment, not a new personal identity or an automatic admin grant. */
export function NativeJoin({ onConnected, onBusyChange }: { onConnected: (node: string) => Promise<void>; onBusyChange: (busy: boolean) => void }) {
  const host = hostBridge()!;
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [url, setUrl] = useState('');
  const [code, setCode] = useState('');
  const [link, setLink] = useState('');
  const [trust, setTrust] = useState(false);
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [joined, setJoined] = useState('');
  useEffect(() => { onBusyChange(busy); return () => onBusyChange(false); }, [busy, onBusyChange]);
  const readPending = () => {
    if (!pendingInvitation) return;
    const u = new URL(takeInvitation());
    setUrl(u.searchParams.get('url') || '');
    setCode(u.searchParams.get('code') || '');
    setLink('');
    setError('');
  };
  useEffect(() => {
    readPending();
    window.addEventListener('delta:pairing-invitation', readPending);
    return () => window.removeEventListener('delta:pairing-invitation', readPending);
  }, []);
  useEffect(() => () => { stream.current?.getTracks().forEach(track => track.stop()); }, []);
  const parseLink = () => { try { acceptInvitation(link.trim()); readPending(); } catch (err) { setError(joinError(err)); } };
  async function startScan() {
    setError('');
    if (!navigator.mediaDevices?.getUserMedia) { setError(tr('native.noCamera')); return; }
    setScanning(true);
    try {
      const live = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      stream.current = live;
      if (video.current) video.current.srcObject = live;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const tick = () => {
        if (!stream.current || !video.current || !ctx) return;
        const w = video.current.videoWidth, h = video.current.videoHeight;
        if (w && h) {
          canvas.width = w; canvas.height = h;
          ctx.drawImage(video.current, 0, 0);
          const found = jsQR(ctx.getImageData(0, 0, w, h).data, w, h);
          if (found) { stopScan(); try { acceptInvitation(found.data); readPending(); } catch (err) { setError(joinError(err)); } return; }
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    } catch { setScanning(false); setError(tr('native.noCamera')); }
  }
  function stopScan() {
    stream.current?.getTracks().forEach(track => track.stop());
    stream.current = null;
    setScanning(false);
  }
  async function connect() {
    setBusy(true); setError('');
    try {
      let node = joined;
      if (!node) {
        const result = await host.call({ capability: 'peers.join', args: { url: pairingAddress(url), code: code.trim(), trust_admin: trust, local_url: '' } }) as { node_id: string };
        node = result.node_id;
        if (!node) throw Error(tr('onboarding.invalidPeer'));
        setJoined(node); setCode('');
      }
      const info = await host.call({ capability: 'core.info', node }) as { node_id: string };
      if (info.node_id !== node) throw Error(tr('onboarding.invalidPeer'));
      await onConnected(node);
    } catch (err) { setError(joinError(err)); }
    finally { setBusy(false); }
  }
  return <div className="col gap-3">
    <p className="muted">{tr('onboarding.connectHint')}</p>
    {error && <div className="banner err" role="alert">{error}</div>}
    {!joined && <>
      {scanning && <video ref={video} autoPlay playsInline muted style={{ width: '100%', maxHeight: 280, background: '#000', borderRadius: 12 }} />}
      <div className="row gap-2" style={{ flexWrap: 'wrap' }}>
        <Button disabled={busy} onClick={() => scanning ? stopScan() : void startScan()}>{tr(scanning ? 'native.stopScan' : 'native.scan')}</Button>
      </div>
      <label>{tr('onboarding.invitationLink')}<input className="input" disabled={busy} value={link} onChange={e => setLink(e.target.value)} maxLength={2048} autoComplete="off" spellCheck={false} /></label>
      <Button disabled={busy || !link.trim()} onClick={parseLink}>{tr('onboarding.useInvitation')}</Button>
      <p role="status">{url ? tr('native.ready') : tr('native.waiting')}</p>
      <label className="check"><input type="checkbox" disabled={busy} checked={trust} onChange={e => setTrust(e.target.checked)} />{tr('native.trust')}</label>
    </>}
    {joined && <p role="status">{tr('onboarding.peerJoined')}</p>}
    <Button variant="primary" disabled={busy || (!joined && (!url.trim() || !code.trim()))} onClick={() => void connect()}>{tr(joined ? 'onboarding.continue' : 'native.join')}</Button>
  </div>;
}
