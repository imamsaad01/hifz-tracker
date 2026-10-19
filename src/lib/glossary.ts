// One place for what each term means. Shown by the (i) buttons next to labels.
export const GLOSSARY = {
  new: { label: 'New lesson', short: 'New lesson', text: 'Ayahs you are memorising for the first time. Learn them, read them to your teacher, and once your teacher signs them off they count as memorised.' },
  recent: { label: 'Recent revision', short: 'Recent revision', text: 'Everything you memorised in the last few days (your recent new lessons). Read it every day so it settles before it joins your Old revision.' },
  old: { label: 'Old revision', short: 'Old revision', text: 'Pages you memorised earlier. On each revision day you read the next few pages in order, so over a few weeks you go through everything you know. Weak pages come back first.' },
  revisionDay: { label: 'Revision day', short: 'Revision day', text: 'The days your teacher set for Old revision (for example Mon, Wed, Fri). On other days the Old box says “Rest day”.' },
  weak: { label: 'Weak page', short: 'Weak page', text: 'A page where you made enough mistakes that it needs extra attention. Weak pages are put first in your Old revision until they are clean again.' },
  signOff: { label: 'Signed off', short: 'Sign-off', text: 'Your teacher has heard or checked what you submitted and confirmed it, with any mistakes noted. “Redo” means read it again and resubmit.' },
  bigMistake: { label: 'Big mistake', short: 'Big mistake', text: 'Forgetting an ayah, skipping or adding words, or mixing up a similar ayah: something that changes the words.' },
  smallMistake: { label: 'Small mistake', short: 'Small mistake', text: 'Tajwīd, pronunciation (makhraj), ḥarakah, madd or ghunnah, or hesitating: the words are right but the reading needs polish.' },
  weekRevision: { label: 'This week’s revision', short: 'Weekly revision', text: 'Counted from what you submitted Monday to Sunday: how many different pages you revised, against your target (Old pages per revision day × revision days).' },
  partner: { label: 'Partner revision', short: 'Partner revision', text: 'Revising with a classmate three times a week (after the lesson, Wednesday night, Friday night). Tick each one on the weekly form.' },
  checkIn: { label: 'Check-in', short: 'Check-in', text: 'Mark yourself present when class starts with the 4-digit code your teacher shows. After the grace time it counts as late.' },
  streak: { label: 'Streak', short: 'Streak', text: 'Days in a row with at least one session. A freeze protects your streak if you miss a day.' },
} as const;
export type GlossaryKey = keyof typeof GLOSSARY;
