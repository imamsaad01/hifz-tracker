// The ten qurrāʾ and their two ruwāt, the uṣūl abwāb, and the mutūn. Codes match public.riwayah_codes().

export interface Rawi { code: string; en: string; ar: string }
export interface Qari { key: string; en: string; ar: string; ruwat: [Rawi, Rawi] }

export const QURRA: Qari[] = [
  { key: 'nafi', en: 'Nāfiʿ', ar: 'نافع', ruwat: [{ code: 'nafi.qalun', en: 'Qālūn', ar: 'قالون' }, { code: 'nafi.warsh', en: 'Warsh', ar: 'ورش' }] },
  { key: 'ibnkathir', en: 'Ibn Kathīr', ar: 'ابن كثير', ruwat: [{ code: 'ibnkathir.bazzi', en: 'al-Bazzī', ar: 'البزي' }, { code: 'ibnkathir.qunbul', en: 'Qunbul', ar: 'قنبل' }] },
  { key: 'abuamr', en: 'Abū ʿAmr', ar: 'أبو عمرو', ruwat: [{ code: 'abuamr.duri', en: 'ad-Dūrī', ar: 'الدوري' }, { code: 'abuamr.susi', en: 'as-Sūsī', ar: 'السوسي' }] },
  { key: 'ibnamir', en: 'Ibn ʿĀmir', ar: 'ابن عامر', ruwat: [{ code: 'ibnamir.hisham', en: 'Hishām', ar: 'هشام' }, { code: 'ibnamir.ibndhakwan', en: 'Ibn Dhakwān', ar: 'ابن ذكوان' }] },
  { key: 'asim', en: 'ʿĀṣim', ar: 'عاصم', ruwat: [{ code: 'asim.shubah', en: 'Shuʿbah', ar: 'شعبة' }, { code: 'asim.hafs', en: 'Ḥafṣ', ar: 'حفص' }] },
  { key: 'hamzah', en: 'Ḥamzah', ar: 'حمزة', ruwat: [{ code: 'hamzah.khalaf', en: 'Khalaf', ar: 'خلف' }, { code: 'hamzah.khallad', en: 'Khallād', ar: 'خلاد' }] },
  { key: 'kisai', en: 'al-Kisāʾī', ar: 'الكسائي', ruwat: [{ code: 'kisai.abulharith', en: 'Abū al-Ḥārith', ar: 'أبو الحارث' }, { code: 'kisai.duri', en: 'ad-Dūrī', ar: 'الدوري' }] },
  { key: 'abujafar', en: 'Abū Jaʿfar', ar: 'أبو جعفر', ruwat: [{ code: 'abujafar.ibnwardan', en: 'Ibn Wardān', ar: 'ابن وردان' }, { code: 'abujafar.ibnjammaz', en: 'Ibn Jammāz', ar: 'ابن جماز' }] },
  { key: 'yaqub', en: 'Yaʿqūb', ar: 'يعقوب', ruwat: [{ code: 'yaqub.ruways', en: 'Ruways', ar: 'رويس' }, { code: 'yaqub.rawh', en: 'Rawḥ', ar: 'روح' }] },
  { key: 'khalaf', en: 'Khalaf al-ʿĀshir', ar: 'خلف العاشر', ruwat: [{ code: 'khalaf.ishaq', en: 'Isḥāq', ar: 'إسحاق' }, { code: 'khalaf.idris', en: 'Idrīs', ar: 'إدريس' }] },
];
const RAWI = new Map(QURRA.flatMap(q => q.ruwat.map(r => [r.code, { ...r, qari: q }] as const)));
export const rawiOf = (code: string) => RAWI.get(code);
/** "Qālūn ʿan Nāfiʿ" */
export const riwayahLabel = (code: string) => { const r = RAWI.get(code); return r ? `${r.en} ʿan ${r.qari.en}` : code; };
export const riwayahLabelAr = (code: string) => { const r = RAWI.get(code); return r ? `${r.ar} عن ${r.qari.ar}` : code; };
/** Short summary: whole qāriʾ when both ruwāt are chosen, else the rāwī. */
export function riwayatSummary(codes: string[]): string {
  const set = new Set(codes);
  return QURRA.flatMap(q => { const both = q.ruwat.every(r => set.has(r.code)); if (both) return [q.en]; return q.ruwat.filter(r => set.has(r.code)).map(r => `${r.en} (${q.en})`); }).join(' · ');
}

export const USUL: Array<{ key: string; en: string; ar: string }> = [
  { key: 'istiadhah', en: 'Istiʿādhah', ar: 'الاستعاذة' },
  { key: 'basmalah', en: 'Basmalah', ar: 'البسملة' },
  { key: 'mim_jam', en: 'Umm al-Qurʾān & mīm al-jamʿ', ar: 'سورة أم القرآن وميم الجمع' },
  { key: 'idgham_kabir', en: 'al-Idghām al-kabīr', ar: 'الإدغام الكبير' },
  { key: 'ha_kinayah', en: 'Hāʾ al-kināyah', ar: 'هاء الكناية' },
  { key: 'madd', en: 'Madd & qaṣr', ar: 'المد والقصر' },
  { key: 'hamzatayn_kalimah', en: 'Two hamzahs in one word', ar: 'الهمزتان من كلمة' },
  { key: 'hamzatayn_kalimatayn', en: 'Two hamzahs in two words', ar: 'الهمزتان من كلمتين' },
  { key: 'hamz_mufrad', en: 'al-Hamz al-mufrad', ar: 'الهمز المفرد' },
  { key: 'naql', en: 'Naql', ar: 'نقل حركة الهمزة إلى الساكن قبلها' },
  { key: 'waqf_hamzah', en: 'Waqf of Ḥamzah & Hishām on hamz', ar: 'وقف حمزة وهشام على الهمز' },
  { key: 'idh_qad', en: 'Idh, qad, tāʾ al-taʾnīth, hal & bal', ar: 'الإظهار والإدغام: إذ وقد وتاء التأنيث وهل وبل' },
  { key: 'qarubat', en: 'Letters close in makhraj', ar: 'حروف قربت مخارجها' },
  { key: 'nun_sakinah', en: 'Nūn sākinah & tanwīn', ar: 'أحكام النون الساكنة والتنوين' },
  { key: 'imalah', en: 'Fatḥ & imālah', ar: 'الفتح والإمالة وبين اللفظين' },
  { key: 'imalah_ha', en: 'Imālah of hāʾ al-taʾnīth', ar: 'إمالة هاء التأنيث في الوقف' },
  { key: 'raat', en: 'Rāʾāt', ar: 'مذاهبهم في الراءات' },
  { key: 'lamat', en: 'Lāmāt', ar: 'اللامات' },
  { key: 'waqf_awakhir', en: 'Waqf on word endings', ar: 'الوقف على أواخر الكلم' },
  { key: 'waqf_marsum', en: 'Waqf on the rasm', ar: 'الوقف على مرسوم الخط' },
  { key: 'yaat_idafah', en: 'Yāʾāt al-iḍāfah', ar: 'ياءات الإضافة' },
  { key: 'yaat_zawaid', en: 'Yāʾāt al-zawāʾid', ar: 'ياءات الزوائد' },
];
export const babLabel = (key: string) => USUL.find(b => b.key === key)?.en ?? key;

export const MUTUN = [
  { key: 'shatibiyyah', en: 'Shāṭibiyyah', ar: 'الشاطبية', lines: 1173 },
  { key: 'durrah', en: 'Durrah', ar: 'الدرة المضية', lines: 241 },
  { key: 'tayyibah', en: 'Ṭayyibah', ar: 'طيبة النشر', lines: 1014 },
] as const;
export type MatnKey = typeof MUTUN[number]['key'];
export const matnOf = (k: string | null | undefined) => MUTUN.find(m => m.key === k) ?? null;

export const RESULTS = [['excellent', 'Excellent'], ['good', 'Very good'], ['pass', 'Pass'], ['repeat', 'Repeat']] as const;
export type QResult = typeof RESULTS[number][0];
export const resultLabel = (r: string | null) => RESULTS.find(x => x[0] === r)?.[1] ?? '—';

/** khatmah tracks: one for jamʿ, else one per riwayah */
export const tracksOf = (p: { riwayat: string[]; mode: 'ifrad' | 'jam' }) => (p.mode === 'jam' ? ['jam'] : p.riwayat);
export const trackLabel = (t: string, p: { riwayat: string[] }) => (t === 'jam' ? `Jamʿ: ${riwayatSummary(p.riwayat)}` : riwayahLabel(t));

/** How much a qira'at student aims to read to the teacher each class (pages ≈ Madani muṣḥaf) */
export const CLASS_GOALS: Array<{ key: string; label: string; pages: number }> = [
  { key: 'half_page', label: '½ page', pages: 0.5 }, { key: 'page', label: '1 page', pages: 1 }, { key: '2_pages', label: '2 pages', pages: 2 },
  { key: 'quarter_hizb', label: '1 rubʿ (¼ ḥizb)', pages: 2.5 }, { key: 'half_hizb', label: '½ ḥizb', pages: 5 }, { key: 'hizb', label: '1 ḥizb', pages: 10 }, { key: 'juz', label: '1 juzʾ', pages: 20 },
];
export const classGoalOf = (k: string | null | undefined) => CLASS_GOALS.find(g => g.key === k) ?? null;
/** "about 9 months" for one khatmah at this goal and number of classes a week */
export function khatmahPace(goalKey: string | null | undefined, classesPerWeek: number, surahsDone = 0): string | null {
  const g = classGoalOf(goalKey); if (!g || !classesPerWeek) return null;
  const pagesLeft = 604 * (1 - surahsDone / 114);
  const weeks = Math.ceil(pagesLeft / g.pages / classesPerWeek);
  return weeks <= 10 ? `about ${weeks} week${weeks > 1 ? 's' : ''}` : weeks < 104 ? `about ${Math.round(weeks / 4.35)} months` : `about ${(weeks / 52).toFixed(1).replace(/\.0$/, '')} years`;
}
