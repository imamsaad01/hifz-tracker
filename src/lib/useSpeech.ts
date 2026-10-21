// Listening for recitation, tuned for phones: the browser's free speech recognition (Arabic), restarted quietly
// whenever the phone stops it (Android ends a session after each pause; iOS after ~60 s), "no-speech" and
// "aborted" are ignored, and the screen is kept awake while listening.
import { useCallback, useEffect, useRef, useState } from 'react';

type SR = { lang: string; continuous: boolean; interimResults: boolean; maxAlternatives: number; start(): void; stop(): void; abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null; onerror: ((e: { error: string }) => void) | null; onstart: (() => void) | null };
const SRClass = (): (new () => SR) | null => { if (typeof window === 'undefined') return null; const w = window as unknown as Record<string, unknown>; return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as (new () => SR) | null; };
export const canListen = () => !!SRClass();
const split = (t: string) => t.split(/\s+/).filter(Boolean);

export function useSpeech() {
  const [on, setOn] = useState(false); const [heard, setHeard] = useState<string[]>([]); const [err, setErr] = useState('');
  const [live, setLive] = useState(false);            // true while the microphone is actually open (between restarts it blinks off)
  const rec = useRef<SR | null>(null); const want = useRef(false); const done = useRef<string[]>([]); const sess = useRef<string[]>([]);
  const lock = useRef<{ release(): Promise<void> } | null>(null); const restarts = useRef(0); const timer = useRef<number | null>(null);
  const wake = async (yes: boolean) => {
    try { if (yes && !lock.current) lock.current = await (navigator as unknown as { wakeLock: { request(t: string): Promise<{ release(): Promise<void> }> } }).wakeLock.request('screen'); else if (!yes && lock.current) { await lock.current.release(); lock.current = null; } } catch { /* not supported */ }
  };
  const boot = useCallback(() => {
    const C = SRClass(); if (!C) return;
    const r = new C(); r.lang = 'ar-SA'; r.continuous = true; r.interimResults = true; r.maxAlternatives = 1;
    r.onstart = () => setLive(true);
    r.onresult = e => {
      const fin: string[] = []; let interim = '';
      for (let k = 0; k < e.results.length; k++) { const t = e.results[k][0].transcript; if (e.results[k].isFinal) fin.push(t); else interim += ` ${t}`; }
      sess.current = split(fin.join(' ')); restarts.current = 0;
      setHeard([...done.current, ...sess.current, ...split(interim)]);
    };
    r.onerror = e => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { want.current = false; setErr('Allow the microphone for this site (in the browser’s site settings), then tap the microphone again.'); }
      else if (e.error === 'network') { setErr('Listening needs an internet connection. It will keep trying.'); }
      else if (e.error === 'audio-capture') { want.current = false; setErr('No microphone was found. Check that another app is not using it.'); }
      // 'no-speech' and 'aborted' are normal pauses: the restart below carries on
    };
    r.onend = () => {
      setLive(false); done.current = [...done.current, ...sess.current]; sess.current = [];
      if (!want.current) { setOn(false); wake(false); return; }
      if (++restarts.current > 40) { want.current = false; setOn(false); wake(false); setErr('Listening stopped. Tap the microphone to carry on.'); return; }
      timer.current = window.setTimeout(() => { try { r.start(); } catch { /* already starting */ } }, restarts.current > 3 ? 400 : 60);
    };
    rec.current = r;
    try { r.start(); } catch { setErr('Could not start the microphone.'); want.current = false; setOn(false); }
  }, []);
  const start = useCallback(() => {
    if (!SRClass()) { setErr('Listening needs Chrome, Edge or Safari.'); return; }
    setErr(''); want.current = true; restarts.current = 0; setOn(true); wake(true); boot();
  }, [boot]);
  const stop = useCallback(() => { want.current = false; if (timer.current) clearTimeout(timer.current); try { rec.current?.stop(); } catch { /* */ } setOn(false); setLive(false); wake(false); }, []);
  const reset = useCallback(() => { done.current = []; sess.current = []; setHeard([]); }, []);
  useEffect(() => () => { want.current = false; if (timer.current) clearTimeout(timer.current); try { rec.current?.abort(); } catch { /* */ } wake(false); }, []);
  // coming back to the tab: the phone may have killed the microphone; start it again
  useEffect(() => { const v = () => { if (document.visibilityState === 'visible' && want.current) { wake(true); try { rec.current?.start(); } catch { /* running */ } } }; document.addEventListener('visibilitychange', v); return () => document.removeEventListener('visibilitychange', v); }, []);
  return { on, live, heard, err, start, stop, reset, setErr };
}
