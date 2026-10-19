# Hifz Tracker

Daily hifz records for Qurʾān programs: **New**, **Recent** and **Old** revision, errors by ayah, scores, attendance, assignments, goals, milestones, reports and parent emails — for admins, teachers, students and parents, with each program's data kept separate by the database.

Everything runs on free plans: **Supabase** (database, email-and-password sign-in, email function), **GitHub Pages** or **Vercel** (website), **Brevo** (300 emails a day).

## Try it without setting anything up

Run it with no Supabase keys and it starts in **preview mode**: the same database schema, security rules and functions run inside your browser (PGlite), filled with fictional sample people. Pick a role on the sign-in page. Nothing leaves the browser and no email is sent.

```bash
npm install
npm run dev        # http://localhost:5173
```

## Put it online (about 30 minutes, all free)

### 1. Supabase (database + sign-in)
1. Create a project at [supabase.com](https://supabase.com) (free plan).
2. **SQL Editor** → run, in order: `supabase/migrations/0001_schema.sql`, `0002_security.sql`, `0003_functions.sql`, `0004_parent_codes.sql`, `0005_leaderboard.sql`, `0006_program_owners.sql`, `0007_school_features.sql`, then `supabase/seed_quran.sql` (Qurʾān reference data, 6,236 ayahs) and `supabase/finish_setup.sql`.
3. **Project Settings → API**: copy the *Project URL* and the *anon public* key.

### 2. Sign-in
People sign in with email and password (built into Supabase, free). In Supabase → **Authentication → Sign In / Providers → Email**, turn **Confirm email** off for the smoothest start (Supabase's built-in email sends only a few messages an hour); turn it back on once you add your own email sender.
Supabase → **Authentication → URL Configuration**: set *Site URL* to your website address and add it to *Redirect URLs* (used by password-reset links).

Google sign-in is optional: create a free OAuth client in Google Cloud Console, enable the Google provider in Supabase, and set `VITE_GOOGLE_AUTH=on`.

### 3. Vercel (the website)
1. Push this folder to a GitHub repository.
2. In [vercel.com](https://vercel.com) → *Add New Project* → import the repository (framework: Vite).
3. Environment variables: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (from step 1). These are public by design; the database rules protect the data.
4. Deploy. Create an account, choose **Start a program** — you become its admin.

### 4. Parent emails (optional)
1. Create a free [Brevo](https://www.brevo.com) account, verify a sender email, create an API key (SMTP & API → API keys).
2. Install the [Supabase CLI](https://supabase.com/docs/guides/cli), then:
   ```bash
   supabase link --project-ref YOUR-PROJECT
   supabase secrets set BREVO_API_KEY=... SENDER_EMAIL=you@example.com SENDER_NAME="Hifz Tracker" CRON_SECRET=$(openssl rand -hex 24)
   supabase functions deploy notify
   ```
3. For the daily "revision falling behind" and weekly summary emails: enable the `pg_cron` and `pg_net` extensions, edit and run `supabase/cron.sql`.

Every attempt (sent, failed or skipped) is listed under **More → Email log**.

## Features

- **Teachers:** Today dashboard with halaqah filter, live class queue, one-tap recording, adab points, assignments, juz tests, calendar, announcements, messages, monthly and term report cards, certificates, applications form, fees record, reports and CSV.
- **Students:** personal plan made from what they know (New / Recent / Old; Old on revision days, a few pages in turn), daily ring, levels and points, badges, streak freezes, reciter player, leaderboard, messages, upcoming tests and events.
- **Parents:** read-only progress, plan, report, certificates and messages for their child.

## How people join

| Who | How |
|---|---|
| Admin | Signs in, chooses *Start a program* |
| Teacher | Enters the 8-character **teacher code** (only admins can see it: More → Join codes) |
| Student | Enters the 6-character **student code**, then answers four setup questions |
| Parent | Enters the 10-character **parent code** shown on the child's page; read-only, one child per code |
| Child without an account | The teacher adds them (Students → Add student) and records for them |

## Security

- Row-level security on every table; tested in `tests/db.test.ts` against a real Postgres engine (tenant isolation, roles, students cannot write records, parents read-only, audit log admin-only, teacher code admin-only).
- Hifz records (sessions, errors, memorised ranges, revision schedule, milestones) can only be written through checked database functions (`record_session`, etc.), never directly.
- No secrets in the browser app. Brevo and cron secrets live only in Supabase function secrets.
- Audit log of every change to students, sessions, attendance, classes, assignments and memberships.
- CSV exports guard against spreadsheet formula injection.

## Qurʾān data

Surah, ayah, page (604-page Madinah mushaf), juz and hizb boundaries come from **quran-meta 6.0.17** (MIT licence), Hafs ʿan ʿĀṣim. `npm run gen:quran` regenerates `src/quran/data.generated.ts` and `supabase/seed_quran.sql` and checks known boundaries (e.g. Al-Mulk 1 is page 562, juz 29). The app stores positions only; it never displays Qurʾān text.

Accuracy, weak pages and revision dates are calculated from what the teacher records. Nothing in the app judges recitation automatically.

## Development

```bash
npm test          # 44 tests: logic, database + security, preview backend
npm run typecheck
npm run build
```

Structure: `src/api` (one Backend interface; Supabase and in-browser implementations), `src/lib` (revision planner, scoring, progress, insights), `src/pages` (teacher, student, parent), `supabase/` (migrations, seed, notify function, cron).

## Not built yet

Audio recordings of recitation, SMS/WhatsApp messages, paid plans/billing (a `subscriptions` table exists but nothing uses it), a super-admin console across programs, and installing as an offline app (the app keeps unsent sessions on the device and retries, but needs a connection to open).

## Who can start a program

Only **platform owners** can create new programs; everyone else joins with a code. To add another owner, run in Supabase → SQL Editor:

```sql
insert into public.platform_owners (user_id) select id from auth.users where email = 'their@email.com';
```

## Attendance, revision forms and phone notifications

- **Class times**: each halaqah has weekly time slots (e.g. Sat 5–8pm, Mon 4:30–8:30pm). Edit them in Classes → Halaqahs.
- **Check-in**: during class, students tap *Check in* and type the 4-digit class code shown on the teacher's Live class / Attendance screen. After the grace period it is recorded as *late*. Ten minutes after class ends, anyone not checked in is marked absent (or excused if they reported it in advance).
- **Absences**: students and parents report absences *before* class. One free absence each semester, plus excused absences up to the limit. Teachers approve these in Classes → Attendance. Semester dates and limits are set in More → Settings.
- **Partner revision form**: three weekly slots (after the lesson, Wed night, Fri night). There are reminders the evening before, a Sunday reminder, and a Monday follow-up when too many are missed.
- **Phone notifications**: each person turns them on from the app (iPhone: add to Home Screen first). Delivery runs through `supabase/functions/push` and pg_cron (see `supabase/cron_push.sql`).
- **Extra roles**: in More → People, give someone more roles (e.g. a parent who also teaches). They use "View as" to switch between them.

## Joining a halaqah, revision reminders, pull to refresh

- **Halaqah requests**: students (or parents) see every halaqah with its times and teacher, and tap *Request to join*. Teachers approve or decline on Today or in Classes → Halaqahs. Both sides get a phone notification.
- **Revision-day reminder**: on each revision day (More → Settings → Revision plan), students get a phone reminder at the time you choose (default 3:00 pm).
- **New announcements first**: a student's or parent's home screen shows new announcements at the top, marked *New*.
- **Pull to refresh**: pull down from the top of any screen to reload it (useful in the installed app).

## Qirāʾāt students

- **Turn it on per student**: on the student's page (*Qirāʾāt student*), at sign-up (a *Qirāʾāt* step), or by the student under *My plan*.
- **Riwāyāt**: any of the 20 riwāyāt of the ten qurrāʾ. Tap a qāriʾ for both ruwāt or a single rāwī. With two or more, choose **jamʿ** (one khatmah together) or **ifrād** (a separate khatmah each).
- **Tests**: farsh by surah or uṣūl by bāb, in chosen riwāyāt. Schedule ahead or record now with a grade (Excellent / Very good / Pass / Repeat), the words or rules they got wrong (optionally per rāwī), and a note. Weak areas (Repeat or mistakes in the last 60 days) are shown to the student and parent.
- **Khatmah**: a 114-surah grid per track. Tap a surah when it is read to you.
- **Matn**: Shāṭibiyyah (1173 lines), Durrah (241) or Ṭayyibah (1014). Students log the lines they memorise; teachers log the lines recited to them.
- **Reminders** (times in More → Settings → Qirāʾāt reminders): a test in 2 days (evening), a test today (morning), today's matn lines (daily), and weak areas (weekly). Runs via `public.qiraat_reminders()` in the `hifz-reminders` cron job.

## Self-logged revision, lesson sizes, ḥāfiẓ sign-up, reciters and app tour

- **Students log revision, teachers check**: students tap *I revised this*. Teachers see *Revision to check* on Today and on each student's page (*Checked*, *Redo* with a note, or *Check all*). The student sees *Waiting for check / Checked / Redo*.
- **Revision start point**: students (or the teacher) choose the surah or page their Old revision starts from. Each revision day continues in page order from there, wrapping round. Weak pages still come first.
- **Lesson size**: ½, 1, 2, 3, 4 or 5 pages (Madani muṣḥaf), or a number of ayahs.
- **Ḥāfiẓ shortcut**: at sign-up, "I am a ḥāfiẓ" marks the whole Qurʾān memorised, skips the lesson questions and goes straight to qirāʾāt.
- **Qirāʾāt goal each class**: ½ page up to 1 juzʾ, with an estimate of how long a khatmah takes at that pace.
- **Riwāyah reciter**: whole-surah recordings for most riwāyāt (mp3quran.net), see `src/lib/reciters.ts`.
- **App tour**: a guided tour on first login for students, parents and teachers. Skip any time; replay from *My plan* or *More*.

## Lesson sign-off, skipped surahs, auto refresh

- **Sign-off**: students tap *I memorised it* (new lesson) or *I revised this* (revision). Teachers see *To sign off* on Today and on each student's page: **Sign off** with big/small mistake counts and a note (quick note chips), **Send back to redo**, or a one-tap tick. A new lesson only counts as memorised once signed off. Revision mistakes mark those pages weak.
- **Skipped surahs**: at sign-up choose *Skipped some surahs*, tap the surahs memorised and choose where the next lesson starts. Surahs passed over are kept as *skipped for later* and come last. Change it later under *Memorised & start* (teacher) or *What I've memorised* (student).
- **No more loading screen on return**: a session renewal no longer reloads the app.
- **Auto refresh**: after a minute without use, or on coming back after a minute away, the screen updates quietly with an "Up to date" note.
- `supabase/manual_signoff_full.sql`: run once in the SQL editor (it removes rows, which the automated tool can't do).
