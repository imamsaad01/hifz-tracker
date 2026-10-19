// Turn phone notifications on or off for this device (Web Push). Works in Chrome/Android and in the installed app on iPhone (iOS 16.4+).
import { useEffect, useState } from 'react';
import { BellRing, BellOff } from 'lucide-react';
import { useApp } from '../app/context';
import { Button, Card, useToast } from './ui';
import { friendly } from '../api/backend';

const KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
const b64 = (s: string) => { const pad = '='.repeat((4 - (s.length % 4)) % 4); const raw = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(raw, c => c.charCodeAt(0)); };
const supported = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;

export function NotifyToggle({ compact }: { compact?: boolean }) {
  const { api, backend } = useApp(); const toast = useToast();
  const [on, setOn] = useState<boolean | null>(null); const [busy, setBusy] = useState(false);
  useEffect(() => { if (!supported()) { setOn(false); return; } navigator.serviceWorker.getRegistration().then(r => r?.pushManager.getSubscription()).then(s => setOn(!!s)).catch(() => setOn(false)); }, []);
  if (backend.kind !== 'live' || !KEY || on === null) return null;
  if (!supported()) {
    if (isIOS() && !standalone()) return compact ? null : <Card className="flex items-start gap-3 p-4 text-sm"><BellRing size={18} className="mt-0.5 text-pine-700" /><span><b>Want reminders on your iPhone?</b> First add Hifz to your home screen (Share → Add to Home Screen), open it from there, then turn on notifications here.</span></Card>;
    return null;
  }
  if (on && compact) return null;
  const enable = async () => {
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { toast('Notifications are blocked. Allow them in your browser or phone settings.', 'err'); return; }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(KEY) });
      const j = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      await api.savePushSubscription({ endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, userAgent: navigator.userAgent });
      setOn(true); toast('Notifications are on for this device.');
    } catch (e) { toast(friendly(e), 'err'); } finally { setBusy(false); }
  };
  const disable = async () => {
    setBusy(true);
    try { const reg = await navigator.serviceWorker.ready; const sub = await reg.pushManager.getSubscription(); if (sub) { await api.removePushSubscription(sub.endpoint).catch(() => 0); await sub.unsubscribe(); } setOn(false); toast('Notifications are off for this device.'); }
    catch (e) { toast(friendly(e), 'err'); } finally { setBusy(false); }
  };
  return <Card className="flex flex-wrap items-center gap-3 p-4">
    {on ? <BellRing size={20} className="text-good" /> : <BellOff size={20} className="text-ink-faint" />}
    <span className="min-w-0 flex-1 text-[15px]"><b>{on ? 'Notifications are on' : 'Get reminders on this phone'}</b><span className="block text-sm text-ink-faint">Class check-in, partner revision nights, messages, new lessons and attendance warnings.</span></span>
    {on ? <Button kind="quiet" busy={busy} onClick={disable}>Turn off</Button> : <Button busy={busy} onClick={enable}><BellRing size={16} />Turn on</Button>}
  </Card>;
}
