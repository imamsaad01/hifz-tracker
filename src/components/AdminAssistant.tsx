// The admin's assistant: type a quick fix in plain English ("move Yusuf to the Thursday halaqah", "Amina does 2 pages now").
// Claude (via the `assistant` edge function, admins only) proposes each change as a card; nothing changes until the admin taps "Do it",
// and then it runs through the normal app calls, so the usual permissions and checks apply.
import { useEffect, useRef, useState } from 'react';
import { Sparkles, Send, Check, X } from 'lucide-react';
import { useOrg } from '../app/context';
import { useOrgData } from '../app/useOrgData';
import { href } from '../app/router';
import type { AiBlock } from '../api/data';
import { friendly } from '../api/backend';
import { GOALS } from './StudentForm';
import { quickCommand, HELP } from '../lib/quickCommand';
import { Button, cx } from './ui';

type Msg = { role: 'user' | 'assistant'; content: string | Array<AiBlock | { type: 'tool_result'; tool_use_id: string; content: string }> };
type Card = { id: string; name: string; input: Record<string, unknown>; state: 'ask' | 'busy' | 'done' | 'skipped' | 'error'; note?: string };
type Line = { who: 'me' | 'ai'; text?: string; cards?: Card[] };
const PAGES: Record<string, string> = { today: href('today'), students: href('students'), live: href('classes', 'live'), attendance: href('classes', 'attendance'), halaqahs: href('classes', 'halaqahs'), calendar: href('classes', 'calendar'), tasks: href('assignments'), reports: href('more', 'reports'), settings: href('more', 'settings') };
const EXAMPLES = ['Who is not in a halaqah?', 'Revision 3 times a week', 'Post: No class next Friday', 'help'];

export function AdminAssistantButton() {
  const { org } = useOrg();
  const [open, setOpen] = useState(false);
  if (org.role !== 'admin') return null;
  return <>
    <button type="button" onClick={() => setOpen(true)} aria-label="Ask the assistant" title="Assistant" className="grid h-11 w-10 sm:w-11 place-items-center rounded-xl text-pine-700 hover:bg-black/5"><Sparkles size={19} /></button>
    {open && <Panel onClose={() => setOpen(false)} />}
  </>;
}

function Panel({ onClose }: { onClose: () => void }) {
  const { api, org, today, refreshSession } = useOrg();
  const { data, reload } = useOrgData();
  const [lines, setLines] = useState<Line[]>([]);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [results, setResults] = useState<Array<{ type: 'tool_result'; tool_use_id: string; content: string }>>([]);
  const [text, setText] = useState(''); const [busy, setBusy] = useState(false); const [setup, setSetup] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [lines, busy]);
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);

  const name = (id: unknown) => data?.students.find(s => s.id === id)?.name ?? 'that student';
  const cls = (id: unknown) => data?.classes.find(c => c.id === id)?.name ?? 'that halaqah';
  const context = () => {
    if (!data) return '';
    const inClass = (sid: string) => data.classes.filter(c => c.studentIds.includes(sid)).map(c => c.name).join(', ') || 'none';
    const st = data.students.filter(s => !s.archivedAt).map(s => `${s.id} | ${s.name} | goal: ${s.goal ?? 'none'} | lesson: ${s.newPages ? `${s.newPages} pages` : `${s.dailyNewAyahs} ayahs`} | ${s.direction} | halaqah: ${inClass(s.id)}`);
    const jr = data.joinRequests.filter(r => r.status === 'pending').map(r => `${r.id} | ${name(r.studentId)} wants ${cls(r.classId)}`);
    return [`Today: ${today}. Program: ${org.name}. Old revision: ${org.settings.revision.perWeek ? `${org.settings.revision.perWeek} times a week at the student's own time` : 'fixed days'}. Lessons are on each halaqah's class day.`,
      `Goals allowed: ${GOALS.join('; ')}`, `Halaqahs (id | name | students):`, ...data.classes.map(c => `${c.id} | ${c.name} | ${c.studentIds.length}`),
      `Students (id | name | goal | lesson | direction | halaqah):`, ...st, `Pending join requests (id | who):`, ...(jr.length ? jr : ['none'])].join('\n');
  };
  const describe = (c: Card): string => {
    const i = c.input;
    switch (c.name) {
      case 'update_student': return `Update ${name(i.student_id)}: ${[i.name && `name → ${i.name}`, i.lesson_pages && `lesson → ${i.lesson_pages} page${Number(i.lesson_pages) === 1 ? '' : 's'}`, i.daily_ayahs && `lesson → ${i.daily_ayahs} ayahs`, i.goal && `goal → ${i.goal}`, i.direction && `direction → ${i.direction === 'back' ? 'from An-Nās backwards' : 'from Al-Fātiḥah forwards'}`].filter(Boolean).join(', ')}`;
      case 'move_student': return `Move ${name(i.student_id)} to ${cls(i.halaqah_id)}`;
      case 'set_revision_times_per_week': return `Old revision: ${i.times} times a week, at their own time`;
      case 'post_announcement': return `Post to ${i.halaqah_id ? cls(i.halaqah_id) : 'everyone'}: “${i.title}” — ${i.body}`;
      case 'decide_join_request': { const r = data?.joinRequests.find(x => x.id === i.request_id); return `${i.approve ? 'Approve' : 'Decline'} ${r ? `${name(r.studentId)} joining ${cls(r.classId)}` : 'the join request'}`; }
      case 'mark_attendance': return `Mark ${name(i.student_id)} ${i.status} on ${i.date}`;
      default: return c.name;
    }
  };
  const run = async (c: Card) => {
    const i = c.input; const sid = String(i.student_id ?? '');
    if (sid && !data?.students.some(s => s.id === sid)) throw new Error('That student is not in this program.');
    switch (c.name) {
      case 'update_student': {
        if (i.goal && !(GOALS as readonly string[]).includes(String(i.goal))) throw new Error('That goal is not one of the goals in the app.');
        const patch: Parameters<typeof api.updateStudent>[1] = {};
        if (i.name) patch.name = String(i.name).trim();
        if (i.lesson_pages) patch.new_pages = Number(i.lesson_pages);
        if (i.daily_ayahs) { patch.daily_new_ayahs = Math.round(Number(i.daily_ayahs)); patch.new_pages = null; }
        if (i.goal) patch.goal = String(i.goal);
        if (i.direction === 'back' || i.direction === 'forward') patch.direction = i.direction;
        await api.updateStudent(sid, patch); break;
      }
      case 'move_student': {
        const to = data!.classes.find(x => x.id === i.halaqah_id); if (!to) throw new Error('That halaqah was not found.');
        if (!to.studentIds.includes(sid)) await api.setClassStudents(org.id, to.id, [...to.studentIds, sid], to.studentIds);
        for (const o of data!.classes) if (o.id !== to.id && o.studentIds.includes(sid)) await api.setClassStudents(org.id, o.id, o.studentIds.filter(x => x !== sid), o.studentIds);
        break;
      }
      case 'set_revision_times_per_week': {
        const n = Math.min(7, Math.max(1, Math.round(Number(i.times))));
        await api.updateOrg(org.id, { settings: { ...org.settings, revision: { ...org.settings.revision, perWeek: n } } }); await refreshSession(); break;
      }
      case 'post_announcement': await api.addAnnouncement(org.id, { classId: i.halaqah_id && data!.classes.some(x => x.id === i.halaqah_id) ? String(i.halaqah_id) : null, title: String(i.title), body: String(i.body ?? ''), pinned: false }); break;
      case 'decide_join_request': await api.decideClassJoin(String(i.request_id), Boolean(i.approve)); break;
      case 'mark_attendance': {
        if (!['present', 'late', 'absent', 'excused'].includes(String(i.status)) || !/^\d{4}-\d{2}-\d{2}$/.test(String(i.date))) throw new Error('That attendance entry did not look right.');
        await api.saveAttendance(org.id, sid, String(i.date), String(i.status), 'in_person'); break;
      }
      default: throw new Error('Unknown action');
    }
  };
  const setCard = (id: string, patch: Partial<Card>) => setLines(ls => ls.map(l => l.cards ? { ...l, cards: l.cards.map(c => c.id === id ? { ...c, ...patch } : c) } : l));
  const result = (id: string, content: string) => { if (!id.startsWith('local_')) setResults(r => [...r, { type: 'tool_result', tool_use_id: id, content }]); };
  const decide = async (c: Card, yes: boolean) => {
    if (!yes) { setCard(c.id, { state: 'skipped' }); result(c.id, 'The admin chose not to do this.'); return; }
    setCard(c.id, { state: 'busy' });
    try { await run(c); setCard(c.id, { state: 'done' }); result(c.id, 'Done.'); reload(); }
    catch (e) { const m = friendly(e); setCard(c.id, { state: 'error', note: m }); result(c.id, `Failed: ${m}`); }
  };

  const send = async (q: string) => {
    q = q.trim(); if (!q || busy) return;
    // answer any cards that were left untouched, so the conversation stays valid
    const open = lines.flatMap(l => l.cards ?? []).filter(c => (c.state === 'ask' || c.state === 'busy') && !c.id.startsWith('local_'));
    // 1) free: common quick fixes are understood right here, with no AI and no cost
    const local = data && quickCommand(q, { students: data.students, classes: data.classes, joins: data.joinRequests, goals: GOALS, today });
    if (local) {
      setText(''); const cards: Card[] = [];
      for (const a of local.actions) { if (a.name === 'open_page') { const p = String(a.input.page); const to = p.startsWith('student:') ? href('students', p.slice(8)) : PAGES[p]; if (to) location.hash = to; } else cards.push({ ...a, state: 'ask' }); }
      setLines(l => [...l, { who: 'me', text: q }, { who: 'ai', text: local.reply, cards }]); return;
    }
    if (setup) { setText(''); setLines(l => [...l, { who: 'me', text: q }, { who: 'ai', text: `I didn't catch that. ${HELP}` }]); return; }
    const pending = [...results, ...open.map(c => ({ type: 'tool_result' as const, tool_use_id: c.id, content: 'Not done; the admin moved on.' }))];
    open.forEach(c => setCard(c.id, { state: 'skipped' }));
    const next: Msg[] = [...msgs, { role: 'user', content: pending.length ? [...pending, { type: 'text' as const, text: q }] : q } as Msg].slice(-20);
    while (next.length && (next[0].role !== 'user' || Array.isArray(next[0].content) && next[0].content.some(b => b.type === 'tool_result'))) next.shift();
    setMsgs(next); setResults([]); setText(''); setLines(l => [...l, { who: 'me', text: q }]); setBusy(true);
    try {
      const r = await api.assistant({ orgId: org.id, messages: next, context: context() });
      const blocks = r.content ?? [];
      setMsgs(m => [...m, { role: 'assistant', content: blocks }]);
      const say = blocks.filter((b): b is Extract<AiBlock, { type: 'text' }> => b.type === 'text').map(b => b.text).join('\n').trim();
      const uses = blocks.filter((b): b is Extract<AiBlock, { type: 'tool_use' }> => b.type === 'tool_use');
      const cards: Card[] = [];
      for (const u of uses) {
        if (u.name === 'open_page') {
          const p = String(u.input.page ?? ''); const to = p.startsWith('student:') ? href('students', p.slice(8)) : PAGES[p];
          if (to) { location.hash = to; } setResults(x => [...x, { type: 'tool_result', tool_use_id: u.id, content: to ? 'Opened.' : 'No such page.' }]);
        } else cards.push({ id: u.id, name: u.name, input: u.input, state: 'ask' });
      }
      setLines(l => [...l, { who: 'ai', text: say || (cards.length ? 'Here is what I would do:' : uses.length ? 'Opened it for you.' : 'Done.'), cards }]);
    } catch (e) {
      const m = friendly(e);
      if (/not_configured/.test(m)) { setSetup(true); setLines(l => [...l, { who: 'ai', text: `I didn't catch that. ${HELP}` }]); }
      else setLines(l => [...l, { who: 'ai', text: `Sorry, that did not work: ${m}` }]);
      setMsgs(m2 => m2.slice(0, -1));
    } finally { setBusy(false); }
  };

  return <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
    <section role="dialog" aria-modal="true" aria-label="Assistant" onClick={e => e.stopPropagation()} className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl dark:bg-[rgb(var(--paper))]">
      <header className="flex items-center gap-2 border-b border-line px-4 pb-3 pt-[max(12px,env(safe-area-inset-top))]">
        <Sparkles size={18} className="text-pine-700" /><h2 className="flex-1 font-bold">Assistant</h2>
        <button type="button" onClick={onClose} aria-label="Close" className="grid h-11 w-11 place-items-center rounded-xl hover:bg-black/5"><X size={18} /></button>
      </header>
      <div className="flex-1 overflow-y-auto px-4 py-4" aria-live="polite">
        {!lines.length && <div className="text-sm text-ink-soft">
          <p>Ask for a quick fix in plain English. I will show each change first; nothing happens until you tap <b>Do it</b>. Common fixes are free; type <b>help</b> to see them.</p>
          <div className="mt-3 flex flex-col gap-2">{EXAMPLES.map(x => <button key={x} type="button" disabled={!data} onClick={() => send(x)} className="min-h-[44px] rounded-xl bg-paper px-3 text-left font-bold text-pine-800 ring-1 ring-line hover:bg-pine-50 disabled:opacity-50">{x}</button>)}</div>
        </div>}
        <div className="flex flex-col gap-3">
          {lines.map((l, k) => <div key={k} className={cx('flex flex-col gap-2', l.who === 'me' && 'items-end')}>
            {l.text && <p className={cx('max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-[15px]', l.who === 'me' ? 'bg-pine-700 text-white' : 'bg-paper ring-1 ring-line')}>{l.text}</p>}
            {l.cards?.map(c => <div key={c.id} className="rounded-xl bg-white p-3 text-sm shadow-card ring-1 ring-line dark:bg-transparent">
              <p className="font-bold">{describe(c)}</p>
              {c.state === 'ask' || c.state === 'busy' ? <div className="mt-2 flex gap-2"><Button busy={c.state === 'busy'} onClick={() => decide(c, true)}><Check size={16} />Do it</Button><Button kind="secondary" disabled={c.state === 'busy'} onClick={() => decide(c, false)}>Skip</Button></div>
                : <p className={cx('mt-1 font-bold', c.state === 'done' ? 'text-good' : c.state === 'error' ? 'text-bad' : 'text-ink-faint')}>{c.state === 'done' ? 'Done' : c.state === 'error' ? c.note : 'Skipped'}</p>}
            </div>)}
          </div>)}
          {busy && <p className="w-fit animate-pulse rounded-2xl bg-paper px-3 py-2 text-ink-faint ring-1 ring-line">Thinking…</p>}
          <div ref={end} />
        </div>
      </div>
      <form className="flex gap-2 border-t border-line p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]" onSubmit={e => { e.preventDefault(); send(text); }}>
        <input value={text} onChange={e => setText(e.target.value)} placeholder={data ? 'e.g. Move Yusuf to the Thursday halaqah' : 'Loading your program…'} aria-label="Message the assistant" disabled={!data} className="min-h-[48px] flex-1 rounded-xl bg-paper px-3 text-[16px] ring-1 ring-line focus:outline-none focus:ring-2 focus:ring-pine-600" />
        <button type="submit" aria-label="Send" disabled={!text.trim() || busy} className="grid h-12 w-12 place-items-center rounded-xl bg-pine-700 text-white disabled:opacity-40"><Send size={18} /></button>
      </form>
    </section>
  </div>;
}
