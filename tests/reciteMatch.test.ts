import { describe, it, expect } from 'vitest';
import { bare, similar, follow } from '../src/lib/reciteMatch';
const ayah = 'قُلۡ هُوَ ٱللَّهُ أَحَدٌ'.split(' ');
describe('recite follow-along', () => {
  it('strips marks and unifies letters', () => expect(bare('ٱللَّهُ')).toBe('الله'));
  it('accepts recognition spelling', () => expect(similar('احد', 'أَحَدٌ')).toBe(true));
  it('rejects different words', () => expect(similar('رب', 'أَحَدٌ')).toBe(false));
  it('follows in order', () => expect(follow(ayah, ['قل', 'هو', 'الله', 'احد']).states).toEqual(['ok', 'ok', 'ok', 'ok']));
  it('marks a skipped word as missed', () => expect(follow(ayah, ['قل', 'الله', 'احد']).states).toEqual(['ok', 'missed', 'ok', 'ok']));
  it('stops where the reciter is', () => expect(follow(ayah, ['قل', 'هو'])).toEqual({ states: ['ok', 'ok', 'hidden', 'hidden'], next: 2, used: 2 }));
  it('flags a wrong word, then accepts the correction', () => { expect(follow(ayah, ['قل', 'هو', 'رب', 'العالمين']).states[2]).toBe('wrong'); expect(follow(ayah, ['قل', 'هو', 'رب', 'العالمين', 'الله']).states[2]).toBe('fixed'); });
  it('accepts everyday spelling of muṣḥaf words', () => expect(follow(['ٱلصَّلَوٰةَ', 'وَءَاتُواْ'], ['الصلاة', 'واتوا']).next).toBe(2));
});

import { maddSlip } from '../src/lib/reciteMatch';
describe('vowel-length (madd) check', () => {
  it('catches a madd cut short', () => expect(maddSlip('قل', 'قَالَ')).toBe('short'));
  it('catches a missing long ee', () => expect(maddSlip('فه', 'فِيهِ')).toBe('short'));
  it('catches a missing ṣilah (small yaa)', () => expect(maddSlip('به', 'بِهِۦ')).toBe('short'));
  it('catches an added long vowel', () => expect(maddSlip('لكوم', 'لَكُمۡ')).toBe('long'));
  it('accepts the standard spelling of ٱلرَّحۡمَٰنِ', () => expect(maddSlip('الرحمن', 'ٱلرَّحۡمَٰنِ')).toBeNull());
  it('accepts العالمين for ٱلۡعَٰلَمِينَ', () => expect(maddSlip('العالمين', 'ٱلۡعَٰلَمِينَ')).toBeNull());
  it('accepts a correct madd', () => expect(maddSlip('قال', 'قَالَ')).toBeNull());
  it('ignores the silent alif after waaw', () => expect(maddSlip('قالوا', 'قَالُوا۟')).toBeNull());
  it('does not blame noise', () => expect(maddSlip('كتب', 'قَالَ')).toBeNull());
  it('accepts the long ee in ٱلرَّحِيمِ', () => expect(maddSlip('الرحيم', 'ٱلرَّحِيمِ')).toBeNull());
  it('accepts tanween with alif', () => expect(maddSlip('أحدا', 'أَحَدًا')).toBeNull());
});
