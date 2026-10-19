import type { OrgSettings } from './types';
/** Accuracy for one session: 100 − weights × errors per page, floored at 0. */
export function accuracy(errorsMajor: number, errorsMinor: number, pages: number, w: OrgSettings['accuracy']): number {
  const p = Math.max(1, pages);
  return Math.max(0, Math.round(100 - (w.major * errorsMajor + w.minor * errorsMinor) / p));
}
export function validScore(v: number | null, scale: number): boolean {
  return v === null || (Number.isFinite(v) && v >= (scale === 5 ? 1 : 0) && v <= scale);
}
export const errorBand = (total: number, s: OrgSettings['revision']) => (total >= s.failThreshold ? 'fail' : total >= s.weakThreshold ? 'weak' : 'clean');
