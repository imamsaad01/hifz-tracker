-- Qira'at students: riwayat (jamʿ or ifrād), farsh/uṣūl tests, khatmah progress, matn memorisation, reminders.

-- The 20 riwayat of the ten qurrāʾ (qāriʾ.rāwī)
create or replace function public.riwayah_codes() returns text[] language sql immutable as $$
  select array['nafi.qalun','nafi.warsh','ibnkathir.bazzi','ibnkathir.qunbul','abuamr.duri','abuamr.susi','ibnamir.hisham','ibnamir.ibndhakwan',
    'asim.shubah','asim.hafs','hamzah.khalaf','hamzah.khallad','kisai.abulharith','kisai.duri','abujafar.ibnwardan','abujafar.ibnjammaz',
    'yaqub.ruways','yaqub.rawh','khalaf.ishaq','khalaf.idris']
$$;
create or replace function public.matn_lines(m text) returns int language sql immutable as $$
  select case m when 'shatibiyyah' then 1173 when 'durrah' then 241 when 'tayyibah' then 1014 else 0 end
$$;
create or replace function public.matn_name(m text) returns text language sql immutable as $$
  select case m when 'shatibiyyah' then 'Shāṭibiyyah' when 'durrah' then 'Durrah' when 'tayyibah' then 'Ṭayyibah' else m end
$$;

create table if not exists public.qiraat_profiles (
  student_id uuid primary key references public.students (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  active boolean not null default true,
  riwayat text[] not null default '{}',
  mode text not null default 'ifrad' check (mode in ('ifrad', 'jam')),
  matn text check (matn in ('shatibiyyah', 'durrah', 'tayyibah')),
  matn_daily_lines int not null default 3 check (matn_daily_lines between 1 and 40),
  updated_at timestamptz not null default now()
);
create table if not exists public.qiraat_tests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  kind text not null check (kind in ('farsh', 'usul')),
  surah int check (surah between 1 and 114),
  bab text check (char_length(bab) <= 80),
  title text not null check (char_length(title) between 2 and 120),
  riwayat text[] not null default '{}',
  scheduled_on date,
  taken_on date,
  status text not null default 'scheduled' check (status in ('scheduled', 'done')),
  result text check (result in ('excellent', 'good', 'pass', 'repeat')),
  mistakes jsonb not null default '[]'::jsonb check (jsonb_typeof(mistakes) = 'array' and jsonb_array_length(mistakes) <= 60),
  note text check (char_length(note) <= 1000),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  check ((kind = 'farsh' and surah is not null) or (kind = 'usul' and bab is not null))
);
create index if not exists qiraat_tests_student on public.qiraat_tests (student_id, status);
create index if not exists qiraat_tests_org on public.qiraat_tests (org_id, scheduled_on);
create table if not exists public.qiraat_khatmah (
  student_id uuid not null references public.students (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  track text not null check (char_length(track) <= 40),
  surah int not null check (surah between 1 and 114),
  done_on date not null default current_date,
  primary key (student_id, track, surah)
);
create table if not exists public.qiraat_matn_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  matn text not null check (matn in ('shatibiyyah', 'durrah', 'tayyibah')),
  line_from int not null check (line_from >= 1),
  line_to int not null,
  kind text not null default 'memorised' check (kind in ('memorised', 'recited')),
  date date not null default current_date,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  check (line_to >= line_from and line_to <= public.matn_lines(matn))
);
create index if not exists qiraat_matn_student on public.qiraat_matn_log (student_id, matn);

alter table public.qiraat_profiles enable row level security;
alter table public.qiraat_tests enable row level security;
alter table public.qiraat_khatmah enable row level security;
alter table public.qiraat_matn_log enable row level security;
revoke all on public.qiraat_profiles, public.qiraat_tests, public.qiraat_khatmah, public.qiraat_matn_log from anon;
grant select on public.qiraat_profiles to authenticated;
grant select, insert, update, delete on public.qiraat_tests, public.qiraat_khatmah, public.qiraat_matn_log to authenticated;

create policy qiraat_profiles_read on public.qiraat_profiles for select to authenticated using (public.is_staff(org_id) or public.can_see_student(student_id));
create policy qiraat_tests_read on public.qiraat_tests for select to authenticated using (public.is_staff(org_id) or public.can_see_student(student_id));
create policy qiraat_tests_staff on public.qiraat_tests for all to authenticated using (public.is_staff(org_id))
  with check (public.is_staff(org_id) and exists (select 1 from public.students s where s.id = student_id and s.org_id = qiraat_tests.org_id));
create policy qiraat_khatmah_read on public.qiraat_khatmah for select to authenticated using (public.is_staff(org_id) or public.can_see_student(student_id));
create policy qiraat_khatmah_staff on public.qiraat_khatmah for all to authenticated using (public.is_staff(org_id))
  with check (public.is_staff(org_id) and exists (select 1 from public.students s where s.id = student_id and s.org_id = qiraat_khatmah.org_id));
create policy qiraat_matn_read on public.qiraat_matn_log for select to authenticated using (public.is_staff(org_id) or public.can_see_student(student_id));
create policy qiraat_matn_staff on public.qiraat_matn_log for all to authenticated using (public.is_staff(org_id))
  with check (public.is_staff(org_id) and exists (select 1 from public.students s where s.id = student_id and s.org_id = qiraat_matn_log.org_id));
-- a student logs lines they memorised themselves; "recited" entries are the teacher's
create policy qiraat_matn_self on public.qiraat_matn_log for insert to authenticated
  with check (kind = 'memorised' and exists (select 1 from public.students s where s.id = student_id and s.org_id = qiraat_matn_log.org_id and s.user_id = auth.uid()));

-- Set a student's qira'at profile: the teacher, or the student themself (e.g. when signing up).
create or replace function public.set_qiraat_profile(p_student uuid, p jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare s public.students; r text[]; m text; mt text; lines int; act boolean;
begin
  select * into s from public.students where id = p_student and archived_at is null;
  if not found or not (public.is_staff(s.org_id) or s.user_id = auth.uid()) then raise exception 'Not allowed' using errcode = '42501'; end if;
  r := array(select distinct x from jsonb_array_elements_text(coalesce(p->'riwayat', '[]'::jsonb)) x where x = any (public.riwayah_codes()) order by 1);
  act := coalesce((p->>'active')::boolean, true);
  if act and coalesce(array_length(r, 1), 0) = 0 then raise exception 'Choose at least one riwayah' using errcode = '22023'; end if;
  m := case when coalesce(array_length(r, 1), 0) > 1 and p->>'mode' = 'jam' then 'jam' else 'ifrad' end;
  mt := nullif(p->>'matn', '');
  if mt is not null and public.matn_lines(mt) = 0 then raise exception 'Unknown matn' using errcode = '22023'; end if;
  lines := least(40, greatest(1, coalesce((p->>'matn_daily_lines')::int, 3)));
  insert into public.qiraat_profiles (student_id, org_id, active, riwayat, mode, matn, matn_daily_lines, updated_at)
  values (s.id, s.org_id, act, r, m, mt, lines, now())
  on conflict (student_id) do update set active = excluded.active, riwayat = excluded.riwayat, mode = excluded.mode, matn = excluded.matn,
    matn_daily_lines = excluded.matn_daily_lines, updated_at = now();
end $$;

-- Teacher schedules or marks a farsh / uṣūl test (one call for both, so arrays and notes are stored the same way everywhere).
create or replace function public.save_qiraat_test(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare s public.students; tid uuid := nullif(p->>'id', '')::uuid; r text[]; st text; kd text;
begin
  select * into s from public.students where id = (p->>'student_id')::uuid;
  if not found or not public.is_staff(s.org_id) then raise exception 'Teachers only' using errcode = '42501'; end if;
  r := array(select distinct x from jsonb_array_elements_text(coalesce(p->'riwayat', '[]'::jsonb)) x where x = any (public.riwayah_codes()) order by 1);
  st := case when p->>'result' is not null and p->>'result' <> '' then 'done' else 'scheduled' end;
  kd := p->>'kind';
  if tid is null then
    insert into public.qiraat_tests (org_id, student_id, kind, surah, bab, title, riwayat, scheduled_on, taken_on, status, result, mistakes, note)
    values (s.org_id, s.id, kd, case when kd = 'farsh' then (p->>'surah')::int end, case when kd = 'usul' then p->>'bab' end, p->>'title', r,
      nullif(p->>'scheduled_on', '')::date, case when st = 'done' then coalesce(nullif(p->>'taken_on', '')::date, (public.org_local_now(s.org_id))::date) end,
      st, nullif(p->>'result', ''), coalesce(p->'mistakes', '[]'::jsonb), nullif(trim(p->>'note'), ''))
    returning id into tid;
  else
    update public.qiraat_tests t set kind = kd, surah = case when kd = 'farsh' then (p->>'surah')::int end, bab = case when kd = 'usul' then p->>'bab' end,
      title = p->>'title', riwayat = r, scheduled_on = nullif(p->>'scheduled_on', '')::date, status = st, result = nullif(p->>'result', ''),
      taken_on = case when st = 'done' then coalesce(nullif(p->>'taken_on', '')::date, t.taken_on, (public.org_local_now(s.org_id))::date) end,
      mistakes = coalesce(p->'mistakes', '[]'::jsonb), note = nullif(trim(p->>'note'), '')
    where t.id = tid and t.student_id = s.id;
    if not found then raise exception 'Test not found' using errcode = 'P0002'; end if;
  end if;
  return tid;
end $$;

-- Phone reminders for qira'at students (run every 5 minutes with the other reminders).
create or replace function public.qiraat_reminders() returns int
language plpgsql security definer set search_path = public as $$
declare o record; t record; p record; local timestamp; n int := 0; k text; q jsonb;
  t_eve time; t_morn time; t_matn time; t_weak time; weak_day int; nxt int; total int; items text;
begin
  for o in select * from public.organizations where deleted_at is null loop
    local := public.org_local_now(o.id); q := coalesce(o.settings->'qiraat', '{}'::jsonb);
    t_eve := coalesce(nullif(q->>'testEveTime', ''), '18:00')::time;
    t_morn := coalesce(nullif(q->>'testMorningTime', ''), '08:00')::time;
    t_matn := coalesce(nullif(q->>'matnTime', ''), '07:30')::time;
    t_weak := coalesce(nullif(q->>'weakTime', ''), '17:00')::time;
    weak_day := coalesce((q->>'weakDay')::int, 5);
    -- tests: two days before (evening) and on the day (morning)
    if local::time between t_eve and t_eve + interval '15 minutes' then
      for t in select * from public.qiraat_tests where org_id = o.id and status = 'scheduled' and scheduled_on = local::date + 2 loop
        k := 'qt2:' || t.id;
        if not exists (select 1 from public.reminders_sent where key = k) then
          insert into public.reminders_sent (key) values (k);
          perform public.enqueue(u.user_id, 'Test in 2 days: ' || t.title, 'On ' || to_char(t.scheduled_on, 'FMDay') || '. Revise it in your riwāyāt and check last time''s mistakes.', '#/home')
          from public.student_audience(t.student_id) u;
          n := n + 1;
        end if;
      end loop;
    end if;
    if local::time between t_morn and t_morn + interval '15 minutes' then
      for t in select * from public.qiraat_tests where org_id = o.id and status = 'scheduled' and scheduled_on = local::date loop
        k := 'qt0:' || t.id;
        if not exists (select 1 from public.reminders_sent where key = k) then
          insert into public.reminders_sent (key) values (k);
          perform public.enqueue(u.user_id, 'Test today: ' || t.title, 'Bismillah. Read it through once more before class.', '#/home')
          from public.student_audience(t.student_id) u;
          n := n + 1;
        end if;
      end loop;
    end if;
    -- daily matn lines
    if local::time between t_matn and t_matn + interval '15 minutes' then
      for p in select qp.*, s.user_id from public.qiraat_profiles qp join public.students s on s.id = qp.student_id
               where qp.org_id = o.id and qp.active and qp.matn is not null and s.user_id is not null and s.archived_at is null loop
        k := 'matn:' || p.student_id || ':' || local::date;
        if not exists (select 1 from public.reminders_sent where key = k) then
          total := public.matn_lines(p.matn);
          nxt := coalesce((select max(line_to) from public.qiraat_matn_log l where l.student_id = p.student_id and l.matn = p.matn and l.kind = 'memorised'), 0) + 1;
          if nxt <= total then
            insert into public.reminders_sent (key) values (k);
            perform public.enqueue(p.user_id, 'Today''s matn lines', public.matn_name(p.matn) || ': lines ' || nxt || '–' || least(total, nxt + p.matn_daily_lines - 1) || '. Memorise them, then review the last few days.', '#/home');
            n := n + 1;
          end if;
        end if;
      end loop;
    end if;
    -- weekly: weak areas from recent tests
    if extract(dow from local)::int = weak_day and local::time between t_weak and t_weak + interval '15 minutes' then
      for p in select qp.student_id from public.qiraat_profiles qp join public.students s on s.id = qp.student_id
               where qp.org_id = o.id and qp.active and s.archived_at is null loop
        k := 'weak:' || p.student_id || ':' || local::date;
        if not exists (select 1 from public.reminders_sent where key = k) then
          select string_agg(title, ' · ') into items from (
            select qt.title from public.qiraat_tests qt where qt.student_id = p.student_id and qt.status = 'done' and qt.taken_on >= local::date - 60
              and (qt.result = 'repeat' or jsonb_array_length(qt.mistakes) > 0)
            group by qt.title order by max(qt.taken_on) desc limit 3) w;
          if items is not null then
            insert into public.reminders_sent (key) values (k);
            perform public.enqueue(u.user_id, 'Revise your weak areas', items || '. Go over the words you were corrected on.', '#/home')
            from public.student_audience(p.student_id) u;
            n := n + 1;
          end if;
        end if;
      end loop;
    end if;
  end loop;
  return n;
end $$;

-- Tell the student (and parents) when a test is scheduled or marked
create or replace function public.notify_qiraat_test() returns trigger
language plpgsql security definer set search_path = public as $$
declare who uuid := auth.uid();
begin
  if tg_op = 'INSERT' and new.status = 'scheduled' and new.scheduled_on is not null then
    perform public.enqueue(u.user_id, 'Test scheduled: ' || new.title, 'On ' || to_char(new.scheduled_on, 'Dy DD Mon') || '.', '#/home')
    from public.student_audience(new.student_id) u where u.user_id is distinct from who;
  elsif new.status = 'done' and (tg_op = 'INSERT' or old.status is distinct from 'done') then
    perform public.enqueue(u.user_id, 'Test result: ' || new.title,
      initcap(coalesce(new.result, 'marked')) || case when jsonb_array_length(new.mistakes) > 0 then ' · ' || jsonb_array_length(new.mistakes) || ' word(s) to review' else '' end, '#/home')
    from public.student_audience(new.student_id) u where u.user_id is distinct from who;
  end if;
  return new;
end $$;
create trigger notify_qiraat_test after insert or update on public.qiraat_tests for each row execute function public.notify_qiraat_test();

revoke all on function public.qiraat_reminders() from public, anon, authenticated;
revoke all on function public.notify_qiraat_test() from public, anon, authenticated;
revoke all on function public.set_qiraat_profile(uuid, jsonb) from public, anon;
grant execute on function public.set_qiraat_profile(uuid, jsonb) to authenticated;
revoke all on function public.save_qiraat_test(jsonb) from public, anon;
grant execute on function public.save_qiraat_test(jsonb) to authenticated;
