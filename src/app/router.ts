// Tiny hash router: #/students/abc → ['students', 'abc']. Keeps the app a static site (works on any host).
import { useEffect, useState } from 'react';
const parse = () => window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
export function useRoute(): string[] {
  const [r, setR] = useState(parse);
  useEffect(() => { const f = () => setR(parse()); window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f); }, []);
  return r;
}
export const go = (...parts: string[]) => { window.location.hash = '/' + parts.map(encodeURIComponent).join('/'); };
export const href = (...parts: string[]) => '#/' + parts.map(encodeURIComponent).join('/');
