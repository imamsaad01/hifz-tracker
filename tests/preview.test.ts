// The preview backend: real migrations + sample data, queried through the same interface the app uses.
import { describe, it, expect, beforeAll } from 'vitest';
import { pgliteBackend } from '../src/api/pgliteBackend';
import { PERSONAS } from '../src/api/previewSeed';
import type { Backend } from '../src/api/backend';

let be: Backend;
const [T1, , S1, P1, X1] = PERSONAS.map(p => p.id);
beforeAll(async () => { be = await pgliteBackend(); }, 180000);

describe('preview backend', () => {
  it('seeds a working program', async () => {
    await be.signInAs!(T1);
    const st = await be.select<{ name: string }>({ table: 'students', order: [['name', 'asc']] });
    expect(st.map(s => s.name)).toEqual(['Amina Siddiqui', 'Hana Okafor', 'Ibrahim Rahman', 'Yusra Karim', 'Zayd Haddad']);
    const sessions = await be.select<{ id: string }>({ table: 'sessions', where: [{ op: 'is', col: 'deleted_at', value: null }] });
    expect(sessions.length).toBeGreaterThan(40);
  });
  it('applies RLS per persona', async () => {
    await be.signInAs!(S1);
    expect((await be.select<{ name: string }>({ table: 'students' })).map(s => s.name)).toEqual(['Amina Siddiqui']);
    await be.signInAs!(P1);
    expect((await be.select<{ name: string }>({ table: 'students' })).map(s => s.name)).toEqual(['Ibrahim Rahman']);
    await be.signInAs!(X1);
    expect((await be.select<{ name: string }>({ table: 'students' })).map(s => s.name)).toEqual(['Private Student']);
  });
  it('calls functions through rpc and refuses what RLS forbids', async () => {
    await be.signInAs!(T1);
    const [ibrahim] = await be.select<{ id: string }>({ table: 'students', where: [{ op: 'eq', col: 'name', value: 'Ibrahim Rahman' }] });
    const id = await be.rpc<string>('record_session', { p: { student_id: ibrahim.id, type: 'old', start_ayah_id: 6231, end_ayah_id: 6236, errors_minor: 0 } });
    expect(typeof id).toBe('string');
    await be.signInAs!(P1);
    await expect(be.rpc('record_session', { p: { student_id: ibrahim.id, type: 'old', start_ayah_id: 6231, end_ayah_id: 6236 } })).rejects.toThrow(/Not allowed/);
    await expect(be.insert('classes', { org_id: '00000000-0000-0000-0000-000000000000', name: 'X' })).rejects.toThrow();
  });
});

describe('leaderboard in the preview', () => {
  it('ranks the sample class and marks the signed-in student', async () => {
    await be.signInAs!(S1);
    const [org] = await be.select<{ id: string }>({ table: 'organizations', columns: 'id' });
    const rows = await be.rpc<Array<{ display_name: string; points: number; is_me: boolean }>>('class_leaderboard', { org: org.id, p_days: 7 });
    expect(rows).toHaveLength(5);
    expect(rows.find(r => r.is_me)?.display_name).toBe('Amina Siddiqui');
    expect(rows.some(r => r.display_name === 'Zayd H.')).toBe(true);
    expect(rows.map(r => r.points)).toEqual([...rows.map(r => r.points)].sort((a, b) => b - a));
  });
});
