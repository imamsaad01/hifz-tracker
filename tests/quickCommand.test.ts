import { describe, it, expect } from 'vitest';
import { quickCommand } from '../src/lib/quickCommand';
const GOALS = ['Juz ʿAmma (Juz 30)', 'Juz 29 and 30', 'Juz 26–30', '5 juz', '10 juz', 'Half the Qurʾān', 'The whole Qurʾān'];
const students = [{ id: 's1', name: 'Yusuf Ali', goal: null, archivedAt: null }, { id: 's2', name: 'Amina Siddiqui', goal: 'Juz 29 and 30', archivedAt: null }, { id: 's3', name: 'Zayd Haddad', goal: null, archivedAt: null }, { id: 's4', name: 'Yusuf Khan', goal: null, archivedAt: null }];
const classes = [{ id: 'c1', name: 'Thursday Boys', studentIds: ['s2'] }, { id: 'c2', name: 'Saturday Halaqah', studentIds: ['s3'] }];
const joins = [{ id: 'j1', studentId: 's1', classId: 'c1', status: 'pending' }];
const q = (t: string) => quickCommand(t, { students, classes, joins, goals: GOALS, today: '2026-10-20' });
describe('quick commands (free, no AI)', () => {
  it('moves a student', () => expect(q('move Zayd to thursday')?.actions[0]).toMatchObject({ name: 'move_student', input: { student_id: 's3', halaqah_id: 'c1' } }));
  it('asks when a name is ambiguous', () => expect(q('move Yusuf to Thursday')?.reply).toMatch(/Which one/));
  it('sets lesson pages', () => expect(q('Amina 2 pages a lesson')?.actions[0].input).toMatchObject({ student_id: 's2', lesson_pages: 2 }));
  it('sets a goal', () => expect(q('set Zayd goal to the whole Quran')?.actions[0].input).toMatchObject({ goal: 'The whole Qurʾān' }));
  it('marks attendance yesterday', () => expect(q('mark Zayd absent yesterday')?.actions[0].input).toMatchObject({ student_id: 's3', status: 'absent', date: '2026-10-19' }));
  it('posts announcements', () => expect(q('Post: No class next Friday.')?.actions[0]).toMatchObject({ name: 'post_announcement', input: { title: 'No class next Friday', body: 'No class next Friday.' } }));
  it('revision per week', () => expect(q('revision 3 times a week')?.actions[0].input).toEqual({ times: 3 }));
  it('approves a join request', () => expect(q('approve Yusuf Ali')?.actions[0].input).toEqual({ request_id: 'j1', approve: true }));
  it('lists unplaced students', () => expect(q('Who is not in a halaqah?')?.reply).toMatch(/Yusuf Ali, Yusuf Khan/));
  it('returns null for unknown requests', () => expect(q('write a poem about spring')).toBeNull());
});
