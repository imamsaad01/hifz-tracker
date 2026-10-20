// "This phone" display options: theme and text size.
import { useState } from 'react';
import { Moon, Type } from 'lucide-react';
import { getTheme, getTextSize, setTheme, setTextSize, type Theme, type TextSize } from '../lib/display';
import { Card, Segmented } from './ui';

export function DisplaySettings() {
  const [t, setT] = useState<Theme>(getTheme()); const [z, setZ] = useState<TextSize>(getTextSize());
  return <Card className="flex flex-col gap-3 p-5">
    <h2 className="font-bold">Display on this phone</h2>
    <div><p className="mb-1.5 flex items-center gap-1.5 text-[13px] font-bold text-ink-soft"><Moon size={14} />Theme</p>
      <Segmented label="Theme" value={t} onChange={v => { setT(v); setTheme(v); }} options={[['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']]} /></div>
    <div><p className="mb-1.5 flex items-center gap-1.5 text-[13px] font-bold text-ink-soft"><Type size={14} />Text size</p>
      <Segmented label="Text size" value={z} onChange={v => { setZ(v); setTextSize(v); }} options={[['normal', 'Normal'], ['large', 'Large'], ['xl', 'Extra large']]} /></div>
    <p className="text-xs text-ink-faint">Auto follows your phone’s dark mode.</p>
  </Card>;
}
