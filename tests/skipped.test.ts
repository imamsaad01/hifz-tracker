import { describe, it, expect } from 'vitest';
import { suggestNew, surahOrder } from '../src/lib/suggest';
import { skippedFor, defaultNextFrom } from '../src/components/MemorisedPicker';
import { surahRange, fromAyahId } from '../src/quran';

describe('skipped surahs and start point', () => {
  const mem = [114, 113, 112, 110, 78].map(surahRange);
  it('next lesson starts from the chosen surah, not the gap', () => {
    const r = suggestNew(mem, 'back', 5, null, { from: 77, skipped: [111, 109] })!;
    expect(fromAyahId(r.start).surah).toBe(77);
  });
  it('without a start point it fills the first gap', () => {
    expect(fromAyahId(suggestNew(mem, 'back', 5)!.start).surah).toBe(111);
  });
  it('skipped surahs come last', () => {
    const o = surahOrder('back', { from: 77, skipped: [111] });
    expect(o[0]).toBe(77); expect(o[o.length - 1]).toBe(111);
  });
  it('default start and skipped list from the picker', () => {
    const v = { direction: 'back' as const, surahs: [114, 113, 112, 110, 78], partial: null, nextFrom: defaultNextFrom('back', [114, 113, 112, 110, 78]) };
    expect(v.nextFrom).toBe(77);
    const sk = skippedFor(v);
    expect(sk).toContain(111); expect(sk).toContain(79); expect(sk).not.toContain(77); expect(sk).not.toContain(114);
  });
});
