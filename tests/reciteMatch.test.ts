import { describe, it, expect } from 'vitest';
import { bare, similar, follow } from '../src/lib/reciteMatch';
const ayah = 'قُلۡ هُوَ ٱللَّهُ أَحَدٌ'.split(' ');
describe('recite follow-along', () => {
  it('strips marks and unifies letters', () => expect(bare('ٱللَّهُ')).toBe('الله'));
  it('accepts recognition spelling', () => expect(similar('احد', 'أَحَدٌ')).toBe(true));
  it('rejects different words', () => expect(similar('رب', 'أَحَدٌ')).toBe(false));
  it('follows in order', () => expect(follow(ayah, ['قل', 'هو', 'الله', 'احد']).states).toEqual(['ok', 'ok', 'ok', 'ok']));
  it('marks a skipped word as missed', () => expect(follow(ayah, ['قل', 'الله', 'احد']).states).toEqual(['ok', 'missed', 'ok', 'ok']));
  it('stops where the reciter is', () => expect(follow(ayah, ['قل', 'هو'])).toEqual({ states: ['ok', 'ok', 'hidden', 'hidden'], next: 2 }));
});
