// Teacher search: one box to jump to any student or any part of the app. Opens with the header button, Ctrl/⌘ K or "/".
// Shows recent searches and the students you are most likely to want when it's empty.
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Search as SearchIcon, User, Play, ClipboardCheck, CalendarCheck, School, CalendarDays, ClipboardList, FileText, BookOpenCheck,
  BarChart3, Inbox, Wallet, Settings, KeyRound, UserPlus, Clock, CornerDownLeft, X, Compass, BookOpen, type LucideIcon,
} from 'lucide-react';
import { useOrgData } from '../app/useOrgData';
import { useOrg } from '../app/context';
import { href } from '../app/router';
import { startTour } from './Tour';
import { openMushaf } from './Mushaf';
import { surahNameEn, surahFirstId as surahFirst } from '../quran';
import { cx } from './ui';

type Item = { id: string; label: string; hint?: string; icon: LucideIcon; to?: string; run?: () => void; keys?: string; kind: 'student' | 'go' };
const PAGES: Omit<Item, 'kind'>[] = [
  { id: 'live', label: 'Live class', hint: 'Hear students one by one', icon: Play, to: href('classes', 'live'), keys: 'live hear class queue now' },
  { id: 'signoff', label: 'Sign off new lessons', hint: 'Lessons students submitted', icon: ClipboardCheck, to: href('today'), keys: 'sign off check submitted lesson approve today' },
  { id: 'att', label: 'Attendance', hint: 'Check-ins, absences, code', icon: CalendarCheck, to: href('classes', 'attendance'), keys: 'absent attendance late check in code excuse' },
  { id: 'halaqahs', label: 'Halaqahs', hint: 'Groups and class times', icon: School, to: href('classes', 'halaqahs'), keys: 'halaqah group class times schedule teacher' },
  { id: 'cal', label: 'Calendar', hint: 'Holidays, tests, events', icon: CalendarDays, to: href('classes', 'calendar'), keys: 'calendar holiday event term' },
  { id: 'assign', label: 'Assignments', icon: ClipboardList, to: href('assignments'), keys: 'assign assignment homework task' },
  { id: 'forms', label: 'Revision forms', icon: FileText, to: href('assignments', 'revision'), keys: 'revision form partner weekly' },
  { id: 'tests', label: 'Juz tests', icon: BookOpenCheck, to: href('assignments', 'tests'), keys: 'test exam juz' },
  { id: 'add', label: 'Add a student', icon: UserPlus, to: href('students', 'new'), keys: 'add new student create enrol' },
  { id: 'reports', label: 'Reports', hint: 'Weekly numbers and leaderboard', icon: BarChart3, to: href('more', 'reports'), keys: 'report reports weekly leaderboard stats' },
  { id: 'apps', label: 'Applications and join requests', icon: Inbox, to: href('more', 'applications'), keys: 'join request apply application approve new' },
  { id: 'fees', label: 'Fees', icon: Wallet, to: href('more', 'fees'), keys: 'fees payment money' },
  { id: 'settings', label: 'Settings', hint: 'Revision days, reminders, expectations', icon: Settings, to: href('more', 'settings'), keys: 'settings rules expectations revision days reminders dark mode text size theme' },
  { id: 'codes', label: 'Join codes', icon: KeyRound, to: href('more', 'codes'), keys: 'join code invite' },
  { id: 'mushaf', label: 'Open the muṣḥaf', hint: 'Type a page, e.g. “page 582”', icon: BookOpen, run: () => openMushaf(), keys: 'mushaf mushaf quran page read surah juz' },
  { id: 'tour', label: 'Take the app tour', icon: Compass, run: () => startTour(), keys: 'help tour guide how' },
];
const norm = (t: string) => t.normalize('NFD').replace(/\p{M}/gu, '').replace(/[ʿʾ'’`]/g, '').toLowerCase();
const RECENT = 'hifz-search-recent';
const readRecent = (): string[] => { try { return JSON.parse(localStorage.getItem(RECENT) ?? '[]'); } catch { return []; } };
const saveRecent = (id: string) => { try { localStorage.setItem(RECENT, JSON.stringify([id, ...readRecent().filter(x => x !== id)].slice(0, 5))); } catch { /* private mode */ } };

export function SearchButton() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const typing = /INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement)?.tagName ?? '') || (e.target as HTMLElement)?.isContentEditable;
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) { e.preventDefault(); setOpen(true); }
    };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, []);
  return <>
    <button type="button" onClick={() => setOpen(true)} aria-label="Search students and pages" aria-keyshortcuts="Control+K"
      className="flex h-11 min-w-[44px] items-center gap-2 rounded-xl px-2.5 text-ink-soft hover:bg-black/5 lg:w-64 lg:bg-white lg:px-3 lg:ring-1 lg:ring-line">
      <SearchIcon size={19} /><span className="hidden flex-1 text-left text-sm lg:block">Search</span><kbd className="hidden rounded bg-black/[.05] px-1.5 text-[11px] font-bold text-ink-faint lg:block">Ctrl K</kbd>
    </button>
    {open && <Palette onClose={() => setOpen(false)} />}
  </>;
}

function Palette({ onClose }: { onClose: () => void }) {
  const { data } = useOrgData();
  const { today, org } = useOrg();
  const [q, setQ] = useState(''); const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null); const list = useRef<HTMLUListElement>(null);
  useEffect(() => { input.current?.focus(); const prev = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = prev; }; }, []);
  const students: Item[] = useMemo(() => (data?.students ?? []).map(s => {
    const c = data!.classes.find(x => x.studentIds.includes(s.id));
    return { id: `s:${s.id}`, kind: 'student' as const, label: s.name, hint: c?.name ?? 'Not in a halaqah', icon: User, to: href('students', s.id) };
  }), [data]);
  const pages: Item[] = useMemo(() => PAGES.filter(p => org.role === 'admin' || !['fees', 'settings', 'codes'].includes(p.id)).map(p => ({ ...p, kind: 'go' as const })), [org.role]);
  const all = useMemo(() => [...students, ...pages], [students, pages]);
  const results = useMemo(() => {
    const n = norm(q.trim());
    if (!n) {
      const recent = readRecent().map(id => all.find(x => x.id === id)).filter(Boolean) as Item[];
      // students who have something waiting today: a submitted lesson, or nothing logged yet
      const waiting = (data?.sessions ?? []).filter(x => x.date === today && x.type === 'new' && x.selfLogged && !x.checkStatus).map(x => `s:${x.studentId}`);
      const suggested = students.filter(s => waiting.includes(s.id) && !recent.some(r => r.id === s.id)).slice(0, 4).map(s => ({ ...s, hint: 'Lesson waiting for sign-off' }));
      return [{ head: 'Recent', items: recent }, { head: 'Waiting for you', items: suggested }, { head: 'Go to', items: pages.slice(0, 6) }].filter(g => g.items.length);
    }
    const score = (it: Item) => {
      const l = norm(it.label); const words = l.split(/\s+/); const k = norm(it.keys ?? '');
      if (l.startsWith(n)) return 4; if (words.some(w => w.startsWith(n))) return 3; if (l.includes(n)) return 2; if (k.split(/\s+/).some(w => w.startsWith(n)) || k.includes(n)) return 1; return 0;
    };
    const pm = n.match(/^(?:p|page|pg)\s*(\d{1,3})$/) ?? n.match(/^(\d{1,3})$/);
    const quran: Item[] = [];
    if (pm && +pm[1] >= 1 && +pm[1] <= 604) quran.push({ id: `p:${pm[1]}`, kind: 'go', label: `Muṣḥaf page ${pm[1]}`, icon: BookOpen, run: () => openMushaf({ page: +pm[1] }) });
    for (let k = 1; k <= 114 && quran.length < 3; k++) if (n.length >= 3 && norm(surahNameEn(k)).replace(/^(al|an|ar|as|at|ad|adh|az|ash)-/, '').startsWith(n.replace(/^(al|an|ar|as|at|ad|adh|az|ash)-?/, ''))) quran.push({ id: `q:${k}`, kind: 'go', label: `${surahNameEn(k)} in the muṣḥaf`, hint: `Surah ${k}`, icon: BookOpen, run: () => openMushaf({ ayah: surahFirst(k) }) });
    const hits = all.map(it => ({ it, s: score(it) })).filter(x => x.s > 0).sort((a, b) => b.s - a.s || a.it.label.localeCompare(b.it.label)).map(x => x.it);
    return [{ head: 'Students', items: hits.filter(h => h.kind === 'student').slice(0, 8) }, { head: 'Qurʾān', items: quran }, { head: 'Pages and actions', items: hits.filter(h => h.kind === 'go').slice(0, 6) }].filter(g => g.items.length);
  }, [q, all, students, pages, data, today]);
  const flat = results.flatMap(g => g.items);
  useEffect(() => { setSel(0); }, [q]);
  useEffect(() => { list.current?.querySelector<HTMLElement>(`[data-i="${sel}"]`)?.scrollIntoView({ block: 'nearest' }); }, [sel]);
  const pick = (it: Item | undefined) => { if (!it) return; saveRecent(it.id); onClose(); if (it.run) it.run(); else if (it.to) window.location.hash = it.to.slice(1); };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(flat.length - 1, s + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel(s => Math.max(0, s - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); pick(flat[sel]); }
    else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
  };
  let i = -1;
  return createPortal(<div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-3 pt-[max(12px,env(safe-area-inset-top))] sm:pt-[12vh]" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div role="dialog" aria-modal="true" aria-label="Search" className="flex max-h-[min(560px,85vh)] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-line">
      <div className="flex items-center gap-2 border-b border-line px-4">
        <SearchIcon size={19} className="shrink-0 text-ink-faint" />
        <input ref={input} value={q} onChange={e => setQ(e.target.value)} onKeyDown={onKey} placeholder="Search a student, or type “absent”, “sign off”, “settings”…"
          role="combobox" aria-expanded aria-controls="search-results" aria-activedescendant={flat[sel] ? `sr-${sel}` : undefined} autoComplete="off" spellCheck={false}
          className="min-h-[56px] min-w-0 flex-1 bg-transparent text-[16px] text-ink outline-none focus:outline-none focus-visible:outline-none placeholder:text-ink-faint" />
        <button type="button" onClick={onClose} aria-label="Close search" className="grid h-11 w-11 place-items-center rounded-xl text-ink-faint hover:bg-black/5"><X size={18} /></button>
      </div>
      <ul ref={list} id="search-results" role="listbox" aria-label="Results" className="flex-1 overflow-y-auto overscroll-contain p-2">
        {!data && <li className="px-3 py-6 text-center text-sm text-ink-faint">Loading students…</li>}
        {data && !flat.length && <li className="px-3 py-6 text-center text-sm text-ink-faint">Nothing matches “{q}”. Try a first name, or words like “test”, “fees”, “calendar”.</li>}
        {results.map(g => <li key={g.head} role="presentation">
          <p className="px-3 pb-1 pt-3 text-xs font-bold uppercase tracking-wider text-ink-faint first:pt-1">{g.head === 'Recent' ? <span className="inline-flex items-center gap-1"><Clock size={12} />Recent</span> : g.head}</p>
          <ul role="presentation">{g.items.map(it => { i++; const k = i; const on = k === sel; const I = it.icon;
            return <li key={g.head + it.id} id={`sr-${k}`} data-i={k} role="option" aria-selected={on} onMouseMove={() => setSel(k)} onClick={() => pick(it)}
              className={cx('flex min-h-[48px] cursor-pointer items-center gap-3 rounded-xl px-3', on ? 'bg-pine-50' : '')}>
              <span className={cx('grid h-8 w-8 shrink-0 place-items-center rounded-lg', it.kind === 'student' ? 'bg-pine-100 text-pine-800' : 'bg-black/[.05] text-ink-soft')}>
                {it.kind === 'student' ? <b className="text-xs">{it.label.split(' ').map(w => w[0]).slice(0, 2).join('')}</b> : <I size={16} />}</span>
              <span className="min-w-0 flex-1"><span className="block truncate font-bold text-ink">{it.label}</span>{it.hint && <span className="block truncate text-xs text-ink-faint">{it.hint}</span>}</span>
              {on && <CornerDownLeft size={15} className="hidden shrink-0 text-ink-faint sm:block" />}
            </li>; })}</ul>
        </li>)}
      </ul>
      <p className="hidden border-t border-line px-4 py-2 text-xs text-ink-faint sm:block">↑ ↓ to move · Enter to open · Esc to close</p>
    </div>
  </div>, document.body);
}
