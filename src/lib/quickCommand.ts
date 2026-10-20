// Free, offline understanding of the admin's common quick fixes ("move Yusuf to Thursday", "Amina 2 pages",
// "mark Zayd absent yesterday", "post: no class Friday"). Returns proposed actions in the same shape the AI uses,
// or null when it doesn't recognise the request (then the AI can try, if it's switched on).
import { addDays } from './dates';

export interface QStudent { id: string; name: string; goal: string | null; archivedAt: string | null }
export interface QClass { id: string; name: string; studentIds: string[] }
export interface QJoin { id: string; studentId: string; classId: string; status: string }
export type QAction = { id: string; name: string; input: Record<string, unknown> };
export interface QResult { reply: string; actions: QAction[] }

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ'ʿʾ’`]/g, '').replace(/[^a-z0-9\s:.-]/g, ' ').replace(/\s+/g, ' ').trim();
const words = (s: string) => norm(s).split(' ').filter(Boolean);
let n = 0; const uid = () => `local_${Date.now().toString(36)}_${n++}`;

/** Students named in the text: full-name match first, then first or last name as a whole word. */
function findStudents(text: string, students: QStudent[]): QStudent[] {
  const t = ` ${norm(text)} `; const live = students.filter(s => !s.archivedAt);
  const full = live.filter(s => t.includes(` ${norm(s.name)} `));
  if (full.length) return full;
  const tw = new Set(words(text));
  return live.filter(s => words(s.name).some(w => w.length > 2 && tw.has(w)));
}
function findClass(text: string, classes: QClass[]): QClass[] {
  const t = ` ${norm(text)} `;
  const full = classes.filter(c => t.includes(` ${norm(c.name)} `)); if (full.length) return full;
  const tw = new Set(words(text)); const skip = new Set(['halaqah', 'halaqa', 'class', 'group', 'the']);
  return classes.filter(c => words(c.name).some(w => w.length > 2 && !skip.has(w) && tw.has(w)));
}
const which = (list: { name: string }[]) => `Which one: ${list.slice(0, 5).map(x => x.name).join(', ')}?`;
const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
function dateIn(t: string, today: string): string {
  const m = t.match(/\b(\d{4}-\d{2}-\d{2})\b/); if (m) return m[1];
  if (/\byesterday\b/.test(t)) return addDays(today, -1);
  const d = DAYS.findIndex(x => new RegExp(`\\b(last |on )?${x}\\b`).test(t));
  if (d >= 0) { const now = new Date(`${today}T12:00:00Z`).getUTCDay(); const back = (now - d + 7) % 7; return addDays(today, -back); }
  return today;
}
const NUM: Record<string, number> = { half: 0.5, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, once: 1, twice: 2 };
const num = (s: string) => (s in NUM ? NUM[s] : Number(s));

export const HELP = 'I can do these without any cost:\n• Move Yusuf to Thursday halaqah\n• Amina 2 pages a lesson (or 5 ayahs)\n• Set Bilal goal to Juz 29 and 30\n• Mark Zayd absent yesterday (present, late, excused)\n• Post: No class next Friday\n• Approve Hana (or decline)\n• Revision 3 times a week\n• Who is not in a halaqah?\n• Open reports / settings / attendance';

export function quickCommand(text: string, ctx: { students: QStudent[]; classes: QClass[]; joins: QJoin[]; goals: readonly string[]; today: string }): QResult | null {
  const raw = text.trim(); const t = norm(raw);
  if (!t) return null;
  if (/^(help|what can you do|\?)/.test(t)) return { reply: HELP, actions: [] };

  // announcements: "post: ...", "announce ...", "tell everyone ..."
  const ann = raw.match(/^\s*(post|announce|announcement|tell everyone|send to everyone)\s*(to\s+([^:]+?))?\s*[:\-–]?\s+(.+)$/i);
  if (ann) {
    let classId: string | undefined; let body = ann[4].trim();
    if (ann[3] && !/everyone|all/i.test(ann[3])) { const c = findClass(ann[3], ctx.classes); if (c.length !== 1) return { reply: c.length ? which(c) : `I couldn't find the halaqah “${ann[3]}”.`, actions: [] }; classId = c[0].id; }
    body = body.replace(/^["“]|["”]$/g, '');
    const title = body.split(/[.!?\n]/)[0].slice(0, 60) || 'Announcement';
    return { reply: 'Here is the announcement:', actions: [{ id: uid(), name: 'post_announcement', input: { title, body, ...(classId ? { halaqah_id: classId } : {}) } }] };
  }

  // revision times a week
  const rev = t.match(/revision\D{0,20}(\d|one|two|three|four|five|six|seven|once|twice)\s*(times?|x|days?)?\s*(a|per|each)?\s*week/) ?? t.match(/(\d|once|twice|three|four|five)\s*(times?|x)?\s*(a|per)\s*week\D{0,15}revision/);
  if (rev) { const v = num(rev[1]); if (v >= 1 && v <= 7) return { reply: 'Old revision at their own time:', actions: [{ id: uid(), name: 'set_revision_times_per_week', input: { times: v } }] }; }

  // who is not in a halaqah
  if (/(not|isnt|arent|without|no)\b.*\b(halaqah|halaqa|class|group)|unplaced|not placed/.test(t) && /^(who|which|list|show|any)/.test(t)) {
    const none = ctx.students.filter(s => !s.archivedAt && !ctx.classes.some(c => c.studentIds.includes(s.id)));
    return { reply: none.length ? `Not in a halaqah (${none.length}): ${none.map(s => s.name).join(', ')}.` : 'Everyone is in a halaqah.', actions: [] };
  }
  if (/^(who|which|list|show)\b.*\b(no|without)\b.*\bgoal/.test(t)) {
    const none = ctx.students.filter(s => !s.archivedAt && !s.goal);
    return { reply: none.length ? `No goal yet (${none.length}): ${none.map(s => s.name).join(', ')}.` : 'Everyone has a goal.', actions: [] };
  }
  if (/^(how many|count)\b.*\bstudents/.test(t)) return { reply: `${ctx.students.filter(s => !s.archivedAt).length} students in ${ctx.classes.length} halaqah${ctx.classes.length === 1 ? '' : 's'}.`, actions: [] };

  // open a page
  const open = t.match(/^(open|go to|show me|take me to)\s+(the\s+)?([a-z ]+?)( page)?$/);
  if (open) {
    const p = open[3].trim(); const map: Record<string, string> = { today: 'today', home: 'today', students: 'students', live: 'live', 'live class': 'live', attendance: 'attendance', halaqahs: 'halaqahs', classes: 'halaqahs', calendar: 'calendar', tasks: 'tasks', assignments: 'tasks', reports: 'reports', report: 'reports', settings: 'settings' };
    if (map[p]) return { reply: 'Opening it.', actions: [{ id: uid(), name: 'open_page', input: { page: map[p] } }] };
    const st = findStudents(p, ctx.students); if (st.length === 1) return { reply: `Opening ${st[0].name}.`, actions: [{ id: uid(), name: 'open_page', input: { page: `student:${st[0].id}` } }] };
  }

  // approve / decline join requests
  const jd = t.match(/^(approve|accept|decline|reject|deny)\b/);
  if (jd) {
    const pending = ctx.joins.filter(j => j.status === 'pending');
    const approve = /^(approve|accept)/.test(jd[1]);
    if (/\b(all|everyone)\b/.test(t)) return pending.length ? { reply: `${pending.length} request${pending.length > 1 ? 's' : ''}:`, actions: pending.map(j => ({ id: uid(), name: 'decide_join_request', input: { request_id: j.id, approve } })) } : { reply: 'There are no join requests waiting.', actions: [] };
    const st = findStudents(raw, ctx.students).filter(s => pending.some(j => j.studentId === s.id));
    if (!st.length) return { reply: pending.length ? 'I could not match that to a waiting request.' : 'There are no join requests waiting.', actions: [] };
    if (st.length > 1) return { reply: which(st), actions: [] };
    return { reply: 'Here it is:', actions: pending.filter(j => j.studentId === st[0].id).map(j => ({ id: uid(), name: 'decide_join_request', input: { request_id: j.id, approve } })) };
  }

  // attendance
  const att = t.match(/\b(absent|present|late|excused)\b/);
  if (att && /^(mark|set|put|record)?\s*/.test(t) && !/\bwho\b/.test(t)) {
    const st = findStudents(raw, ctx.students);
    if (st.length) {
      const date = dateIn(t, ctx.today);
      return { reply: st.length > 1 ? `${st.length} students:` : 'Here it is:', actions: st.slice(0, 15).map(s => ({ id: uid(), name: 'mark_attendance', input: { student_id: s.id, date, status: att[1] } })) };
    }
  }

  // move to a halaqah: "move X to Y", "put X in Y", "X to Y halaqah"
  const mv = raw.match(/^\s*(move|put|place|add|switch|transfer)\s+(.+?)\s+(to|in|into|over to)\s+(.+?)\s*$/i);
  if (mv && !/\b(page|pages|ayah|ayahs|goal)\b/i.test(mv[4])) {
    const st = findStudents(mv[2], ctx.students); const c = findClass(mv[4], ctx.classes);
    if (!st.length) return { reply: `I couldn't find a student called “${mv[2]}”.`, actions: [] };
    if (st.length > 1 && !/\band\b|,/.test(mv[2])) return { reply: which(st), actions: [] };
    if (c.length !== 1) return { reply: c.length ? which(c) : `I couldn't find the halaqah “${mv[4]}”. Halaqahs: ${ctx.classes.map(x => x.name).join(', ')}.`, actions: [] };
    return { reply: 'Here it is:', actions: st.map(s => ({ id: uid(), name: 'move_student', input: { student_id: s.id, halaqah_id: c[0].id } })) };
  }

  // lesson size / goal / direction for a student
  const st = findStudents(raw, ctx.students);
  const pages = t.match(/\b(\d+(?:\.\d+)?|half|one|two|three|four|five)\s*(a\s+)?(page|pages|pg)\b/);
  const ayahs = t.match(/\b(\d+)\s*(ayah|ayahs|ayat|verses)\b/);
  const goal = ctx.goals.find(g => t.includes(norm(g))) ?? (/whole quran|full quran|entire quran/.test(t) ? ctx.goals[ctx.goals.length - 1] : /juz amma|juz 30\b/.test(t) && !/29/.test(t) ? ctx.goals[0] : undefined);
  const dir = /backwards|from an ?nas|from the end/.test(t) ? 'back' : /forwards|from al ?fatihah|from the start|from the beginning/.test(t) ? 'forward' : undefined;
  if (st.length && (pages || ayahs || goal || dir)) {
    if (st.length > 1) return { reply: which(st), actions: [] };
    const input: Record<string, unknown> = { student_id: st[0].id };
    if (pages) { const v = num(pages[1]); if (![0.5, 1, 1.5, 2, 3, 4, 5].includes(v)) return { reply: 'Lesson size can be ½, 1, 1½, 2, 3, 4 or 5 pages.', actions: [] }; input.lesson_pages = v; }
    else if (ayahs) input.daily_ayahs = Number(ayahs[1]);
    if (goal) input.goal = goal;
    if (dir) input.direction = dir;
    return { reply: 'Here it is:', actions: [{ id: uid(), name: 'update_student', input }] };
  }
  const rename = raw.match(/^\s*rename\s+(.+?)\s+to\s+(.+?)\s*$/i);
  if (rename) { const s = findStudents(rename[1], ctx.students); if (s.length === 1) return { reply: 'Here it is:', actions: [{ id: uid(), name: 'update_student', input: { student_id: s[0].id, name: rename[2] } }] }; return { reply: s.length ? which(s) : `I couldn't find “${rename[1]}”.`, actions: [] }; }
  return null;
}
