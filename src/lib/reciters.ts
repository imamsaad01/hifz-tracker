// Whole-surah recordings per riwāyah, streamed from mp3quran.net (nothing is stored). URL = server + 3-digit surah + .mp3
// `surahs` lists what a partial recording has; otherwise all 114.
export interface Recording { name: string; server: string; surahs?: number[] }
const C = 'https://cdn.mp3quran.net/audio/';
const r = (name: string, path: string, surahs?: number[]): Recording => ({ name, server: C + path, surahs });

export const RECORDINGS: Record<string, Recording[]> = {
  'nafi.qalun': [r('Maḥmūd Khalīl al-Ḥuṣarī', 'mahmoud-husary/r5/'), r('ʿAlī al-Ḥudhayfī', 'ali-hudhaifi/r2/'), r('Aḥmad Dībān', 'ahmad-deeban/r5/'), r('Muḥammad Abū Snaynah', 'muhammad-abusnaina/r1/'), r('Aḥmad al-Ṭarābulusī', 'ahmad-tarabulsi/r1/')],
  'nafi.warsh': [r('Maḥmūd Khalīl al-Ḥuṣarī', 'mahmoud-husary/r3/'), r('ʿAbd al-Bāsiṭ ʿAbd al-Ṣamad', 'abdulbasit-abdulsamad/r2/'), r('Ibrāhīm al-Dawsarī', 'ibrahim-dosari/r1/'), r('Yāsīn al-Jazāʾirī', 'yassen-jazairi/r1/'), r('ʿUmar al-Qazābrī', 'omar-kazabri/r1/'), r('al-ʿUyūn al-Kūshī', 'laayoun-kouchi/r1/')],
  'ibnkathir.bazzi': [r('Aḥmad Dībān', 'ahmad-deeban/r4/'), r('ʿUkāshah Kamīnī', 'okasha-kameny/r2/'), r('Muḥammad al-ʿAbdullāh (al-Bazzī & Qunbul)', 'muhammad-abdullah/r1/')],
  'ibnkathir.qunbul': [r('Aḥmad Dībān', 'ahmad-deeban/r3/'), r('Muḥammad al-ʿAbdullāh (al-Bazzī & Qunbul)', 'muhammad-abdullah/r1/')],
  'abuamr.duri': [r('Maḥmūd Khalīl al-Ḥuṣarī', 'mahmoud-husary/r4/'), r('Muftāḥ al-Salṭanī', 'muftah-saltani/r1/'), r('Nūrīn Muḥammad Ṣiddīq', 'noreen-siddiq/r1/'), r('al-Fātiḥ al-Zubayr', 'fateh-zubair/r1/'), r('Aḥmad Dībān', 'ahmad-deeban/r6/')],
  'abuamr.susi': [r('ʿAbd al-Rashīd Ṣūfī', 'abdulrasheed-sufi/r2/')],
  'ibnamir.hisham': [r('Aḥmad Dībān (selected surahs)', 'ahmad-deeban/r12/', [1, 2, 3, 4, 5, 6, 7, 8, 9, 13, 85, 90, 92, 93, 94, 95, 99, 100, 101, 103, 105, 107, 108, 110, 112, 113, 114])],
  'ibnamir.ibndhakwan': [r('Muftāḥ al-Salṭanī', 'muftah-saltani/r5/')],
  'asim.shubah': [r('ʿAlī al-Ḥudhayfī', 'ali-hudhaifi/r3/'), r('Aḥmad Dībān', 'ahmad-deeban/r2/')],
  'asim.hafs': [r('Maḥmūd Khalīl al-Ḥuṣarī', 'mahmoud-husary/r1/')],
  'hamzah.khalaf': [r('ʿAbd al-Rashīd Ṣūfī', 'abdulrasheed-sufi/r1/')],
  'kisai.duri': [r('Muḥammad al-ʿAbdullāh', 'muhammad-abdullah/r2/'), r('Muftāḥ al-Salṭanī', 'muftah-saltani/r2/'), r('Maḥmūd al-Shaymī', 'mahmoud-sheimy/r1/')],
  'abujafar.ibnjammaz': [r('Aḥmad Dībān (selected surahs)', 'ahmad-deeban/r13/', [1, 93, 100, 102, 103, 109, 110, 111, 112, 113, 114])],
  'yaqub.ruways': [r('Yāsir al-Mazrūʿī (Ruways & Rawḥ)', 'yasser-mazrouei/r1/')],
  'yaqub.rawh': [r('Yāsir al-Mazrūʿī (Ruways & Rawḥ)', 'yasser-mazrouei/r1/')],
};
export const recordingUrl = (rec: Recording, surah: number) => `${rec.server}${String(surah).padStart(3, '0')}.mp3`;
