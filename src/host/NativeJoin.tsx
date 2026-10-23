import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { hostBridge } from './contract';
import { acceptInvitation, pendingInvitation, takeInvitation, parseInvitation } from './invitations';
import { tr } from '../i18n';
import { Button } from '../ui/primitives';

function joinError(err: unknown) {
  const text = err instanceof Error ? err.message : String(err);
  if (/127\.0\.0\.1|localhost|this machine only/i.test(text)) return tr('native.unreachable');
  if (/invalid or expired/i.test(text)) return tr('native.expired');
  if (/error sending request|\/v1\/call|Failed to fetch|network/i.test(text)) return tr('native.cannotReach');
  return text || tr('native.cannotReach');
}

/**
 * Explicit peer enrollment: exactly two buttons (scan/stop, join), no fields.
 * The invitation arrives from the live camera or a delta:// intent; the clipboard is deliberately never read.
 * The phone never grants the hub admin rights over itself (trust_admin=false).
 */
export function NativeJoin({ onConnected, onBusyChange }: { onConnected: (node: string) => Promise<void>; onBusyChange: (busy: boolean) => void }) {
  const host = hostBridge()!;
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const frame = useRef(0);
  const session = useRef(0);
  const [invitation, setInvitation] = useState<{ url: string; code: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [joined, setJoined] = useState('');
  useEffect(() => { onBusyChange(busy); return () => onBusyChange(false); }, [busy, onBusyChange]);
  const readPending = () => {
    if (!pendingInvitation) return;
    try { setInvitation(parseInvitation(takeInvitation())); setError(''); stopScan(); } catch (err) { setError(joinError(err)); }
  };
  useEffect(() => {
    readPending();
    window.addEventListener('delta:pairing-invitation', readPending);
    return () => window.removeEventListener('delta:pairing-invitation', readPending);
  }, []);
  useEffect(() => stopScan, []);
  async function startScan() {
    setError('');
    if (!navigator.mediaDevices?.getUserMedia) { setError(tr('native.noCamera')); return; }
    const mine = ++session.current;
    setScanning(true);
    try {
      const live = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      if (session.current !== mine) { live.getTracks().forEach(track => track.stop()); return; }
      stream.current = live;
      if (video.current) { video.current.srcObject = live; void video.current.play().catch(() => {}); }
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const tick = () => {
        if (session.current !== mine || !video.current || !ctx) return;
        const w = video.current.videoWidth, h = video.current.videoHeight;
        if (w && h) {
          canvas.width = w; canvas.height = h;
          ctx.drawImage(video.current, 0, 0);
          const found = jsQR(ctx.getImageData(0, 0, w, h).data, w, h);
          if (found) { stopScan(); try { acceptInvitation(found.data); } catch (err) { setError(joinError(err)); } return; }
        }
        frame.current = requestAnimationFrame(tick);
      };
      frame.current = requestAnimationFrame(tick);
    } catch { if (session.current === mine) { setScanning(false); setError(tr('native.noCamera')); } }
  }
  /** Idempotent: invalidates the running loop and releases the camera. */
  function stopScan() {
    session.current++;
    cancelAnimationFrame(frame.current);
    stream.current?.getTracks().forEach(track => track.stop());
    stream.current = null;
    if (video.current) video.current.srcObject = null;
    setScanning(false);
  }
  async function connect() {
    setBusy(true); setError('');
    try {
      let node = joined;
      if (!node) {
        if (!invitation) return;
        const result = await host.call({ capability: 'peers.join', args: { url: invitation.url, code: invitation.code, trust_admin: false, local_url: '' } }) as { node_id: string };
        node = result.node_id;
        if (!node) throw Error(tr('onboarding.invalidPeer'));
        setJoined(node); setInvitation(null);
      }
      const info = await host.call({ capability: 'core.info', node }) as { node_id: string };
      if (info.node_id !== node) throw Error(tr('onboarding.invalidPeer'));
      await onConnected(node);
    } catch (err) { setError(joinError(err)); }
    finally { setBusy(false); }
  }
  return <div className="col gap-3" data-testid="native-join">
    <p className="muted">{tr('onboarding.connectHint')}</p>
    {error && <div className="banner err" role="alert">{error}</div>}
    {!joined && <>
      {scanning && <video ref={video} autoPlay playsInline muted style={{ width: '100%', maxHeight: 280, background: '#000', borderRadius: 12 }} />}
      <Button disabled={busy} onClick={() => scanning ? stopScan() : void startScan()}>{tr(scanning ? 'native.stopScan' : 'native.scan')}</Button>
      <p role="status">{invitation ? tr('native.ready', { host: new URL(invitation.url).host }) : tr('native.waiting')}</p>
    </>}
    {joined && <p role="status">{tr('onboarding.peerJoined')}</p>}
    <Button variant="primary" disabled={busy || (!joined && !invitation)} onClick={() => void connect()}>{tr(joined ? 'onboarding.continue' : 'native.join')}</Button>
  </div>;
}
