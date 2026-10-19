-- 0001 · Tables, types, constraints, indexes.
-- Every organization-owned table has org_id; security is in 0002, server functions in 0003.

do $$ begin
  create type public.member_role as enum ('admin', 'teacher', 'student', 'parent');
  create type public.session_type as enum ('new', 'recent', 'old', 'juz_revision', 'assessment', 'catch_up', 'review', 'other');
  create type public.attendance_status as enum ('present', 'absent', 'excused', 'late');
  create type public.attendance_mode as enum ('in_person', 'online');
  create type public.error_category as enum ('forgot_ayah', 'added_missed_word', 'word_substitution', 'similar_ayah', 'tajweed', 'makharij', 'harakah', 'madd', 'ghunnah', 'waqf_ibtida', 'fluency', 'other');
  create type public.error_severity as enum ('major', 'minor');
  create type public.assignment_type as enum ('new', 'revision', 'listening', 'tajweed', 'other');
  create type public.assignment_status as enum ('assigned', 'started', 'completed', 'reviewed');
  create type public.recorder as enum ('teacher', 'student');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------- Qur'an reference (shared, read-only)
create table if not exists public.quran_surahs (
  number smallint primary key check (number between 1 and 114),
  name_en text not null, name_ar text not null,
  ayah_count smallint not null check (ayah_count > 0),
  first_ayah_id smallint not null
);
create table if not exists public.quran_ayahs (
  id smallint primary key check (id between 1 and 6236),
  surah smallint not null references public.quran_surahs (number),
  ayah smallint not null check (ayah >= 1),
  page smallint not null check (page between 1 and 604),
  juz smallint not null check (juz between 1 and 30),
  hizb smallint not null check (hizb between 1 and 60),
  rub smallint not null check (rub between 1 and 240),
  unique (surah, ayah)
);
create index if not exists quran_ayahs_page on public.quran_ayahs (page);
create index if not exists quran_ayahs_juz on public.quran_ayahs (juz);

-- ---------------------------------------------------------------- organizations and people
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  timezone text not null default 'America/New_York',
  join_code text not null unique default upper(substr(md5(random()::text), 1, 6)),
  teacher_code text not null unique default upper(substr(md5(random()::text), 1, 8)),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create table if not exists public.organization_members (
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.member_role not null,
  display_name text check (display_name is null or char_length(display_name) <= 80),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index if not exists organization_members_user on public.organization_members (user_id);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete restrict,
  user_id uuid references auth.users (id) on delete set null,      -- null: a child without an account, recorded by the teacher
  name text not null check (char_length(name) between 2 and 80),
  age_group text check (age_group is null or char_length(age_group) <= 20),
  direction text not null default 'back' check (direction in ('back', 'forward')),
  daily_new_ayahs smallint not null default 3 check (daily_new_ayahs between 1 and 50),
  goal text check (goal is null or char_length(goal) <= 80),
  guardian_name text check (guardian_name is null or char_length(guardian_name) <= 80),
  guardian_email text check (guardian_email is null or guardian_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  notify boolean not null default true,
  start_date date not null default current_date,
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (org_id, user_id)
);
create index if not exists students_org on public.students (org_id, archived_at);

create table if not exists public.student_guardians (
  student_id uuid not null references public.students (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  primary key (student_id, user_id)
);

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  teacher_user_id uuid references auth.users (id) on delete set null,
  schedule text, starts_on date, ends_on date, notes text,
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  check (ends_on is null or starts_on is null or ends_on >= starts_on)
);
create index if not exists classes_org on public.classes (org_id);
create table if not exists public.class_students (
  class_id uuid not null references public.classes (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  primary key (class_id, student_id)
);

-- ---------------------------------------------------------------- hifz records
create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete restrict,
  student_id uuid not null references public.students (id) on delete restrict,
  date date not null,
  type public.session_type not null,
  start_ayah_id smallint not null references public.quran_ayahs (id),
  end_ayah_id smallint not null references public.quran_ayahs (id),
  errors_major smallint not null default 0 check (errors_major between 0 and 99),
  errors_minor smallint not null default 0 check (errors_minor between 0 and 99),
  score_tajweed numeric(4,1), score_fluency numeric(4,1), score_accuracy numeric(4,1), score_tarteel numeric(4,1), score_overall numeric(4,1),
  attendance public.attendance_status not null default 'present',
  mode public.attendance_mode not null default 'in_person',
  teacher_note text check (teacher_note is null or char_length(teacher_note) <= 1000),
  student_note text check (student_note is null or char_length(student_note) <= 1000),
  follow_up boolean not null default false,
  recorded_by public.recorder not null,
  recorded_by_user uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (start_ayah_id <= end_ayah_id),
  unique (student_id, date, type, start_ayah_id)
);
create index if not exists sessions_student_date on public.sessions (org_id, student_id, date desc);
create index if not exists sessions_org_date on public.sessions (org_id, date desc);

create table if not exists public.session_errors (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  session_id uuid not null references public.sessions (id) on delete cascade,
  ayah_id smallint references public.quran_ayahs (id),
  category public.error_category not null,
  severity public.error_severity not null default 'minor',
  note text check (note is null or char_length(note) <= 300)
);
create index if not exists session_errors_session on public.session_errors (session_id);
create index if not exists session_errors_ayah on public.session_errors (org_id, ayah_id);

create table if not exists public.memorized_ranges (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  start_ayah_id smallint not null references public.quran_ayahs (id),
  end_ayah_id smallint not null references public.quran_ayahs (id),
  memorized_on date not null default current_date,
  source text not null check (source in ('setup', 'session')),
  session_id uuid references public.sessions (id) on delete cascade,
  check (start_ayah_id <= end_ayah_id)
);
create index if not exists memorized_ranges_student on public.memorized_ranges (student_id);

create table if not exists public.revision_items (
  student_id uuid not null references public.students (id) on delete cascade,
  page smallint not null check (page between 1 and 604),
  org_id uuid not null references public.organizations (id) on delete cascade,
  last_reviewed_on date,
  interval_days smallint not null default 1 check (interval_days between 1 and 365),
  lapses smallint not null default 0 check (lapses >= 0),
  due_on date not null,
  primary key (student_id, page)
);
create index if not exists revision_items_due on public.revision_items (org_id, due_on);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete restrict,
  class_id uuid references public.classes (id) on delete set null,
  date date not null,
  status public.attendance_status not null,
  mode public.attendance_mode not null default 'in_person',
  note text check (note is null or char_length(note) <= 300),
  recorded_by_user uuid default auth.uid(),
  unique (student_id, date)
);
create index if not exists attendance_org_date on public.attendance (org_id, date);

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete restrict,
  type public.assignment_type not null,
  start_ayah_id smallint references public.quran_ayahs (id),
  end_ayah_id smallint references public.quran_ayahs (id),
  due_on date not null,
  priority smallint not null default 2 check (priority between 1 and 3),
  instructions text check (instructions is null or char_length(instructions) <= 1000),
  status public.assignment_status not null default 'assigned',
  feedback text check (feedback is null or char_length(feedback) <= 1000),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  check ((start_ayah_id is null and end_ayah_id is null) or (start_ayah_id <= end_ayah_id)),
  unique nulls not distinct (student_id, type, start_ayah_id, due_on)
);
create index if not exists assignments_student on public.assignments (org_id, student_id, status, due_on);

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  period text not null check (period in ('daily', 'weekly', 'monthly', 'custom')),
  metric text not null check (metric in ('new_ayahs', 'revision_pages', 'streak_days', 'sessions', 'complete_juz')),
  target numeric not null check (target > 0),
  starts_on date not null default current_date,
  ends_on date,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  check (ends_on is null or ends_on >= starts_on)
);

create table if not exists public.milestones (
  student_id uuid not null references public.students (id) on delete cascade,
  code text not null,
  org_id uuid not null references public.organizations (id) on delete cascade,
  achieved_on date not null,
  primary key (student_id, code)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  student_id uuid references public.students (id) on delete set null,
  channel text not null default 'email',
  to_address text, template text, subject text, body text,
  status text not null check (status in ('sent', 'failed', 'skipped')),
  error text,
  created_at timestamptz not null default now()
);
create index if not exists notifications_org on public.notifications (org_id, created_at desc);

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  org_id uuid,
  actor uuid default auth.uid(),
  action text not null,
  entity text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  at timestamptz not null default now()
);
create index if not exists audit_logs_org on public.audit_logs (org_id, at desc);

create table if not exists public.subscriptions (      -- V3 placeholder; no payments in V1
  org_id uuid primary key references public.organizations (id) on delete cascade,
  plan text not null default 'free',
  status text not null default 'active'
);
