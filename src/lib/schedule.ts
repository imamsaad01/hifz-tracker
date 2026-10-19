// Class times in the program's time zone.
import type { ClassRow, Slot } from '../api/data';
import { addDays } from './dates';
import { DAY_NAMES } from './revision';

/** current date and minutes-since-midnight in a time zone */
export function nowIn(timeZone: string, now = new Date()): { date: string; minutes: number; dow: number } {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now).map(x => [x.type, x.value]));
  const date = `${p.year}-${p.month}-${p.day}`;
  return { date, minutes: Number(p.hour) * 60 + Number(p.minute), dow: new Date(`${date}T12:00:00Z`).getUTCDay() };
}
export const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0); };
export const fmtTime = (t: string) => { const m = toMin(t); const h = Math.floor(m / 60), mm = m % 60; return `${((h + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`; };
export const slotText = (s: Slot) => `${DAY_NAMES[s.day]} ${fmtTime(s.start)}–${fmtTime(s.end)}`;
export const scheduleText = (slots: Slot[]) => slots.length ? [...slots].sort((a, b) => ((a.day + 6) % 7) - ((b.day + 6) % 7)).map(slotText).join(' · ') : 'No class times set';

export interface ClassToday { cls: ClassRow; slot: Slot; phase: 'before' | 'open' | 'after'; opensAt: number; startsAt: number; endsAt: number }
/** the student's class meeting today, if any, and where we are in it */
export function classToday(classes: ClassRow[], studentId: string, timeZone: string, now = new Date()): ClassToday | null {
  const n = nowIn(timeZone, now);
  for (const c of classes.filter(x => x.studentIds.includes(studentId))) {
    const slot = c.slots.find(s => s.day === n.dow);
    if (!slot) continue;
    const startsAt = toMin(slot.start), endsAt = toMin(slot.end), opensAt = startsAt - c.checkinOpenMin;
    return { cls: c, slot, startsAt, endsAt, opensAt, phase: n.minutes < opensAt ? 'before' : n.minutes <= endsAt ? 'open' : 'after' };
  }
  return null;
}
/** upcoming class dates for a student (including today if class has not started) */
export function nextClassDates(classes: ClassRow[], studentId: string, timeZone: string, count = 8): Array<{ date: string; slot: Slot; cls: ClassRow }> {
  const n = nowIn(timeZone); const out: Array<{ date: string; slot: Slot; cls: ClassRow }> = [];
  const mine = classes.filter(x => x.studentIds.includes(studentId));
  for (let i = 0; i < 60 && out.length < count; i++) {
    const d = addDays(n.date, i); const dow = new Date(`${d}T12:00:00Z`).getUTCDay();
    for (const c of mine) for (const s of c.slots) if (s.day === dow && (i > 0 || n.minutes < toMin(s.start))) out.push({ date: d, slot: s, cls: c });
  }
  return out.slice(0, count);
}
export const weekStart = (iso: string) => { const dow = new Date(`${iso}T12:00:00Z`).getUTCDay(); return addDays(iso, -((dow + 6) % 7)); };
