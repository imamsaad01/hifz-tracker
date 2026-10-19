// CSV export. Cells starting with = + - @ are prefixed so spreadsheets do not run them as formulas.
export function toCsv(rows: Array<Record<string, unknown>>): string {
  if (!rows.length) return '';
  const keys = Object.keys(rows[0]);
  const cell = (v: unknown) => { let s = v === null || v === undefined ? '' : String(v); if (/^[=+\-@]/.test(s)) s = `'${s}`; return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [keys.join(','), ...rows.map(r => keys.map(k => cell(r[k])).join(','))].join('\n');
}
export function downloadCsv(filename: string, rows: Array<Record<string, unknown>>): boolean {
  try {
    const blob = new Blob(['﻿' + toCsv(rows)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    return true;
  } catch { return false; }
}
