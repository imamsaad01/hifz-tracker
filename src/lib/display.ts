// Per-device display choices: theme (auto/light/dark) and text size. Applied as classes on <html>.
export type Theme = 'auto' | 'light' | 'dark';
export type TextSize = 'normal' | 'large' | 'xl';
const get = (k: string, d: string) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const put = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* blocked */ } };
export const getTheme = () => get('hifz-theme', 'auto') as Theme;
export const getTextSize = () => get('hifz-text', 'normal') as TextSize;
const media = () => window.matchMedia('(prefers-color-scheme: dark)');
export function applyDisplay() {
  const t = getTheme(); const dark = t === 'dark' || (t === 'auto' && media().matches);
  const h = document.documentElement; h.classList.toggle('dark', dark);
  h.classList.toggle('text-large', getTextSize() === 'large'); h.classList.toggle('text-xl', getTextSize() === 'xl');
}
export function setTheme(t: Theme) { put('hifz-theme', t); applyDisplay(); }
export function setTextSize(s: TextSize) { put('hifz-text', s); applyDisplay(); }
export function watchSystemTheme() { const m = media(); const f = () => { if (getTheme() === 'auto') applyDisplay(); }; m.addEventListener?.('change', f); }
