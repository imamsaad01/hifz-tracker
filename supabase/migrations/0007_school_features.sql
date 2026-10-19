-- 0007 · School features: announcements, messages, adab points, calendar, juz tests, applications, fees,
-- per-student Old revision amount. Every table is protected by row-level security.

-- per-student daily Old revision (pages per revision day). null = program default.
alter table public.students add column if not exists old_pages smallint check (old_pages is null or old_pages between 1 and 40);

create or replace function public.students_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff(old.org_id) then
    if new.org_id is distinct from old.org_id or new.user_id is distinct from old.user_id or new.parent_code is distinct from old.parent_code
       or new.archived_at is distinct from old.archived_at or new.start_date is distinct from old.start_date or new.old_pages is distinct from old.old_pages then
      raise exception 'Only a teacher can change this' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

-- ------------------------------------------------------------- announcements (class board)
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  class_id uuid references public.classes (id) on delete cascade,      -- null = whole program
  title text not null check (char_length(title) between 1 and 120),
  body text check (body is null or char_length(body) <= 2000),
  pinned boolean not null default false,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists announcements_org on public.announcements (org_id, created_at desc);

-- ------------------------------------------------------------- messages (one thread per student: staff, the student, their parents)
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  sender uuid not null default auth.uid(),
  sender_name text,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists messages_student on public.messages (student_id, created_at);

-- ------------------------------------------------------------- adab & effort points
create table if not exists public.behaviour_points (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  date date not null,
  category text not null check (char_length(category) between 1 and 40),
  value smallint not null check (value in (-1, 1)),
  note text check (note is null or char_length(note) <= 200),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists behaviour_student on public.behaviour_points (student_id, date desc);

-- ------------------------------------------------------------- calendar
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  class_id uuid references public.classes (id) on delete cascade,
  starts_on date not null,
  ends_on date,
  title text not null check (char_length(title) between 1 and 120),
  kind text not null default 'event' check (kind in ('class', 'holiday', 'exam', 'event')),
  notes text check (notes is null or char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  check (ends_on is null or ends_on >= starts_on)
);
create index if not exists events_org on public.events (org_id, starts_on);

-- ------------------------------------------------------------- juz tests / exams
create table if not exists public.exams (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  juz smallint check (juz is null or juz between 1 and 30),
  start_ayah_id smallint, end_ayah_id smallint,
  scheduled_on date not null,
  examiner text check (examiner is null or char_length(examiner) <= 80),
  status text not null default 'scheduled' check (status in ('scheduled', 'passed', 'retake', 'missed')),
  score numeric check (score is null or (score >= 0 and score <= 100)),
  notes text check (notes is null or char_length(notes) <= 1000),
  created_at timestamptz not null default now()
);
create index if not exists exams_student on public.exams (student_id, scheduled_on);

-- ------------------------------------------------------------- applications (public form) and fees
create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  age_group text check (age_group is null or char_length(age_group) <= 20),
  contact text not null check (char_length(contact) between 5 and 120),
  memorised text check (memorised is null or char_length(memorised) <= 200),
  message text check (message is null or char_length(message) <= 1000),
  status text not null default 'new' check (status in ('new', 'contacted', 'accepted', 'declined')),
  created_at timestamptz not null default now()
);
create index if not exists applications_org on public.applications (org_id, created_at desc);

create table if not exists public.fee_records (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  amount numeric not null check (amount >= 0),
  paid_on date,
  method text check (method is null or char_length(method) <= 40),
  note text check (note is null or char_length(note) <= 200),
  unique (student_id, month)
);

-- ------------------------------------------------------------- security
alter table public.announcements enable row level security;
alter table public.messages enable row level security;
alter table public.behaviour_points enable row level security;
alter table public.events enable row level security;
alter table public.exams enable row level security;
alter table public.applications enable row level security;
alter table public.fee_records enable row level security;
revoke all on public.announcements, public.messages, public.behaviour_points, public.events, public.exams, public.applications, public.fee_records from anon;
grant select, insert, update, delete on public.announcements, public.messages, public.behaviour_points, public.events, public.exams, public.applications, public.fee_records to authenticated;

drop policy if exists announcements_read on public.announcements;
create policy announcements_read on public.announcements for select to authenticated using (public.is_member(org_id));
drop policy if exists announcements_staff on public.announcements;
create policy announcements_staff on public.announcements for all to authenticated using (public.is_staff(org_id)) with check (public.is_staff(org_id));

drop policy if exists messages_read on public.messages;
create policy messages_read on public.messages for select to authenticated using (public.can_see_student(student_id));
drop policy if exists messages_send on public.messages;
create policy messages_send on public.messages for insert to authenticated
  with check (sender = auth.uid() and public.can_see_student(student_id)
              and org_id = (select s.org_id from public.students s where s.id = student_id));

drop policy if exists behaviour_read on public.behaviour_points;
create policy behaviour_read on public.behaviour_points for select to authenticated using (public.can_see_student(student_id));
drop policy if exists behaviour_staff on public.behaviour_points;
create policy behaviour_staff on public.behaviour_points for all to authenticated using (public.is_staff(org_id)) with check (public.is_staff(org_id));

drop policy if exists events_read on public.events;
create policy events_read on public.events for select to authenticated using (public.is_member(org_id));
drop policy if exists events_staff on public.events;
create policy events_staff on public.events for all to authenticated using (public.is_staff(org_id)) with check (public.is_staff(org_id));

drop policy if exists exams_read on public.exams;
create policy exams_read on public.exams for select to authenticated using (public.can_see_student(student_id));
drop policy if exists exams_staff on public.exams;
create policy exams_staff on public.exams for all to authenticated using (public.is_staff(org_id)) with check (public.is_staff(org_id));

drop policy if exists applications_staff on public.applications;
create policy applications_staff on public.applications for all to authenticated using (public.is_staff(org_id)) with check (public.is_staff(org_id));

drop policy if exists fees_staff on public.fee_records;
create policy fees_staff on public.fee_records for all to authenticated using (public.is_staff(org_id)) with check (public.is_staff(org_id));

-- public application form: anyone with the link (program id) can apply; nothing else is readable
create or replace function public.program_public_name(p_org uuid) returns text
language sql stable security definer set search_path = public as $$
  select name from public.organizations where id = p_org and deleted_at is null;
$$;
create or replace function public.submit_application(p_org uuid, p jsonb) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.organizations where id = p_org and deleted_at is null) then raise exception 'Program not found' using errcode = 'P0002'; end if;
  if (select count(*) from public.applications where org_id = p_org and created_at > now() - interval '1 day') >= 100 then
    raise exception 'Too many applications today. Please try again tomorrow.' using errcode = '54000';
  end if;
  insert into public.applications (org_id, name, age_group, contact, memorised, message)
  values (p_org, trim(p->>'name'), nullif(trim(p->>'age_group'), ''), trim(p->>'contact'), nullif(trim(p->>'memorised'), ''), nullif(trim(p->>'message'), ''));
  return true;
end $$;
revoke all on function public.program_public_name(uuid), public.submit_application(uuid, jsonb) from public;
grant execute on function public.program_public_name(uuid), public.submit_application(uuid, jsonb) to anon, authenticated;

do $$ declare t text; begin
  foreach t in array array['exams', 'fee_records', 'announcements', 'behaviour_points'] loop
    execute format('drop trigger if exists audit on public.%I', t);
    execute format('create trigger audit after insert or update or delete on public.%I for each row execute function public.audit_row()', t);
  end loop;
end $$;

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table public.messages; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.announcements; exception when duplicate_object then null; end;
  end if;
end $$;
