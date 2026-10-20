import { cx } from './ui';
export function Brand({ small, light, iconOnly }: { small?: boolean; light?: boolean; iconOnly?: boolean }) {
  return <div className="flex items-center gap-2.5">
    <svg width={small ? 30 : 38} height={small ? 30 : 38} viewBox="0 0 64 64" aria-hidden><rect width="64" height="64" rx="14" fill={light ? '#FFFFFF' : '#215549'} /><path d="M14 19c7-3 13-2 18 2 5-4 11-5 18-2v27c-7-3-13-2-18 2-5-4-11-5-18-2z" fill="none" stroke={light ? '#215549' : '#E9D9B6'} strokeWidth="3.5" strokeLinejoin="round" /><path d="M32 21v27" stroke={light ? '#215549' : '#E9D9B6'} strokeWidth="3.5" /></svg>
    {!iconOnly && <span className={cx('whitespace-nowrap font-bold', small ? 'text-[17px]' : 'text-xl', light ? 'text-white' : 'text-ink')}>Hifz Tracker</span>}
  </div>;
}
