-- 0008 · Class times and student check-in, absence requests and attendance standing, the weekly partner-revision form,
-- extra roles per person, site-owner tools, and phone notifications (queued here, delivered by the `push` Edge Function).

-- ------------------------------------------------------------- extra roles (e.g. a teacher who is also a parent)
alter table public.organization_members add column if not exists extra_roles public.member_role[] not null default '{}';
create or replace function public.has_role(org uuid, roles public.member_role[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.organization_members m
                 where m.org_id = org and m.user_id = auth.uid() and (m.role = any (roles) or m.extra_roles && roles));
$$;

-- ------------------------------------------------------------- class times
-- schedule_slots: [{"day":6,"start":"17:00","end":"20:00"}, {"day":1,"start":"16:30","end":"20:30"}]  (day: 0 = Sunday)
alter table public.classes add column if not exists schedule_slots jsonb not null default '[]';
alter table public.classes add column if not exists location text not null default 'mosque' check (location in ('mosque', 'online', 'both'));
alter table public.classes add column if not exists checkin_open_min smallint not null default 15 check (checkin_open_min between 0 and 120);
alter table public.classes add column if not exists late_after_min smallint not null default 10 check (late_after_min between 0 and 120);
alter table public.classes add column if not exists require_code boolean not null default true;

alter table public.attendance add column if not exists checked_in_at timestamptz;
alter table public.attendance add column if not exists source text not null default 'teacher' check (source in ('teacher', 'student', 'auto'));

alter table public.students add column if not exists rules_ack_at timestamptz;

-- ------------------------------------------------------------- absence requests (must be sent before class)
create table if not exists public.absence_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  date date not null,
  kind text not null default 'excuse' check (kind in ('free', 'excuse')),
  reason text check (reason is null or char_length(reason) <= 500),
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  requested_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  unique (student_id, date)
);

-- ------------------------------------------------------------- weekly partner-revision form
create table if not exists public.revision_checkins (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  week_start date not null,                 -- Monday
  slot text not null check (char_length(slot) between 1 and 30),
  done boolean not null default true,
  partner text check (partner is null or char_length(partner) <= 80),
  pages text check (pages is null or char_length(pages) <= 120),
  recorded boolean not null default false,
  recording_link text check (recording_link is null or char_length(recording_link) <= 500),
  note text check (note is null or char_length(note) <= 300),
  created_at timestamptz not null default now(),
  unique (student_id, week_start, slot)
);

-- ------------------------------------------------------------- notifications
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  endpoint text not null unique check (char_length(endpoint) <= 1000),
  p256dh text not null, auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
create table if not exists public.notification_queue (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  title text not null, body text, url text,
  created_at timestamptz not null default now(),
  sent_at timestamptz, error text
);
create index if not exists notification_queue_unsent on public.notification_queue (created_at) where sent_at is null and error is null;
create table if not exists public.reminders_sent (key text primary key, at timestamptz not null default now());

-- ------------------------------------------------------------- security
alter table public.absence_requests enable row level security;
alter table public.revision_checkins enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_queue enable row level security;
alter table public.reminders_sent enable row level security;
revoke all on public.absence_requests, public.revision_checkins, public.push_subscriptions, public.notification_queue, public.reminders_sent from anon;
revoke all on public.notification_queue, public.reminders_sent from authenticated;
grant select, insert, update, delete on public.absence_requests, public.revision_checkins, public.push_subscriptions to authenticated;

create policy absence_read on public.absence_requests for select to authenticated using (public.can_see_student(student_id));
create policy absence_staff on public.absence_requests for all to authenticated using (public.is_staff(org_id)) with check (public.is_staff(org_id));

create policy revision_form_read on public.revision_checkins for select to authenticated using (public.can_see_student(student_id));
create policy revision_form_write on public.revision_checkins for all to authenticated
  using (exists (select 1 from public.students s where s.id = student_id and (s.user_id = auth.uid() or public.is_staff(s.org_id))))
  with check (exists (select 1 from public.students s where s.id = student_id and s.org_id = revision_checkins.org_id and (s.user_id = auth.uid() or public.is_staff(s.org_id))));

create policy push_own on public.push_subscriptions for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- a student may acknowledge the class rules (rules_ack_at) but nothing else protected
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

-- ------------------------------------------------------------- helpers
create or replace function public.org_local_now(org uuid) returns timestamp
language sql stable security definer set search_path = public as $$
  select now() at time zone o.timezone from public.organizations o where o.id = org;
$$;
-- today's slot for a class, if it meets today
create or replace function public.class_slot_today(p_class uuid) returns table (starts time, ends time)
language sql stable security definer set search_path = public as $$
  select (s->>'start')::time, (s->>'end')::time
  from public.classes c, jsonb_array_elements(c.schedule_slots) s
  where c.id = p_class and (s->>'day')::int = extract(dow from public.org_local_now(c.org_id))::int
  limit 1;
$$;
-- 4-digit code that changes every class day; only staff can read it
create or replace function public.class_checkin_code(p_class uuid) returns text
language plpgsql stable security definer set search_path = public as $$
declare c public.classes; o public.organizations;
begin
  select * into c from public.classes where id = p_class;
  if not found or not public.is_staff(c.org_id) then raise exception 'Not allowed' using errcode = '42501'; end if;
  select * into o from public.organizations where id = c.org_id;
  return lpad((abs(hashtext(p_class::text || public.org_local_now(c.org_id)::date::text || o.teacher_code)) % 10000)::text, 4, '0');
end $$;

create or replace function public.enqueue(p_user uuid, p_title text, p_body text, p_url text) returns void
language sql security definer set search_path = public as $$
  insert into public.notification_queue (user_id, title, body, url) select p_user, left(p_title, 120), left(p_body, 300), p_url where p_user is not null;
$$;
create or replace function public.student_audience(sid uuid) returns table (user_id uuid)
language sql stable security definer set search_path = public as $$
  select s.user_id from public.students s where s.id = sid and s.user_id is not null
  union select g.user_id from public.student_guardians g where g.student_id = sid;
$$;
create or replace function public.staff_of(org uuid) returns table (user_id uuid)
language sql stable security definer set search_path = public as $$
  select m.user_id from public.organization_members m where m.org_id = org and (m.role in ('admin', 'teacher') or m.extra_roles && array['admin', 'teacher']::public.member_role[]);
$$;
create or replace function public.range_text(a int, b int) returns text
language sql stable security definer set search_path = public as $$
  select case when sa.surah = sb.surah then s1.name_en || ' ' || sa.ayah || '–' || sb.ayah
              else s1.name_en || ' ' || sa.ayah || ' – ' || s2.name_en || ' ' || sb.ayah end
  from public.quran_ayahs sa, public.quran_ayahs sb, public.quran_surahs s1, public.quran_surahs s2
  where sa.id = a and sb.id = b and s1.number = sa.surah and s2.number = sb.surah;
$$;

-- ------------------------------------------------------------- check-in, absence requests
create or replace function public.student_check_in(p_class uuid, p_code text default null, p_mode text default 'in_person') returns text
language plpgsql security definer set search_path = public as $$
declare c public.classes; st public.students; t time; sl record; local timestamp; status public.attendance_status; prev public.attendance;
begin
  select * into c from public.classes where id = p_class and archived_at is null;
  if not found then raise exception 'Class not found' using errcode = 'P0002'; end if;
  select s.* into st from public.students s join public.class_students cs on cs.student_id = s.id and cs.class_id = c.id where s.user_id = auth.uid() and s.archived_at is null;
  if not found then raise exception 'You are not in this halaqah' using errcode = '42501'; end if;
  select * into sl from public.class_slot_today(c.id);
  if sl.starts is null then raise exception 'There is no class today' using errcode = '22023'; end if;
  local := public.org_local_now(c.org_id); t := local::time;
  if t < sl.starts - make_interval(mins => c.checkin_open_min) then raise exception 'Check-in opens % minutes before class', c.checkin_open_min using errcode = '22023'; end if;
  if t > sl.ends then raise exception 'Class has finished; ask your teacher to mark you' using errcode = '22023'; end if;
  if c.require_code and coalesce(trim(p_code), '') <> lpad((abs(hashtext(c.id::text || local::date::text || (select teacher_code from public.organizations where id = c.org_id))) % 10000)::text, 4, '0') then
    raise exception 'That code is not right. Ask your teacher for today''s code.' using errcode = '22023';
  end if;
  select * into prev from public.attendance where student_id = st.id and date = local::date;
  if found and prev.source = 'teacher' then return prev.status::text; end if;
  status := case when t > sl.starts + make_interval(mins => c.late_after_min) then 'late' else 'present' end;
  insert into public.attendance (org_id, student_id, class_id, date, status, mode, checked_in_at, source, recorded_by_user)
  values (c.org_id, st.id, c.id, local::date, status, case when p_mode = 'online' then 'online' else 'in_person' end::public.attendance_mode, now(), 'student', auth.uid())
  on conflict (student_id, date) do update set status = excluded.status, mode = excluded.mode, checked_in_at = excluded.checked_in_at, source = 'student', class_id = excluded.class_id;
  return status::text;
end $$;

-- p: student_id, date, kind ('free' | 'excuse'), reason
create or replace function public.request_absence(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare st public.students; d date := (p->>'date')::date; local timestamp; starts time; rid uuid; k text := coalesce(p->>'kind', 'excuse');
begin
  select * into st from public.students where id = (p->>'student_id')::uuid and archived_at is null;
  if not found or not public.can_see_student(st.id) then raise exception 'Not allowed' using errcode = '42501'; end if;
  if k not in ('free', 'excuse') then raise exception 'Unknown absence type' using errcode = '22023'; end if;
  if k = 'excuse' and coalesce(trim(p->>'reason'), '') = '' then raise exception 'Give a reason for an excused absence' using errcode = '22023'; end if;
  local := public.org_local_now(st.org_id);
  if d < local::date then raise exception 'Absences must be sent before class' using errcode = '22023'; end if;
  if k = 'free' and (select count(*) from public.absence_requests r, public.organizations o
                     where r.student_id = st.id and r.kind = 'free' and r.date <> d and o.id = st.org_id
                       and r.date between coalesce((o.settings->'attendance'->>'semesterStart')::date, '1900-01-01') and coalesce((o.settings->'attendance'->>'semesterEnd')::date, '2999-12-31'))
                    >= (select coalesce((settings->'attendance'->>'freeAbsences')::int, 1) from public.organizations where id = st.org_id) then
    raise exception 'The free absence for this semester is already used. Send an excused absence with a reason.' using errcode = '22023';
  end if;
  if d = local::date and not public.is_staff(st.org_id) then
    select min((s->>'start')::time) into starts from public.classes c join public.class_students cs on cs.class_id = c.id and cs.student_id = st.id, jsonb_array_elements(c.schedule_slots) s
      where (s->>'day')::int = extract(dow from local)::int;
    if starts is not null and local::time >= starts then raise exception 'Class has already started. Absences must be sent before class.' using errcode = '22023'; end if;
  end if;
  insert into public.absence_requests (org_id, student_id, date, kind, reason, status)
  values (st.org_id, st.id, d, k, nullif(trim(p->>'reason'), ''), case when k = 'free' then 'approved' else 'pending' end)
  on conflict (student_id, date) do update set kind = excluded.kind, reason = excluded.reason, status = excluded.status, created_at = now(), decided_at = null
  returning id into rid;
  return rid;
end $$;

-- ------------------------------------------------------------- attendance standing for the semester
-- settings.attendance: {semesterStart, semesterEnd, freeAbsences (1), excusedAbsences (2)}
create or replace function public.attendance_standing_internal(sid uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  with st as (select s.*, coalesce(o.settings->'attendance', '{}') a from public.students s join public.organizations o on o.id = s.org_id where s.id = sid),
  sem as (select coalesce((a->>'semesterStart')::date, date_trunc('year', now())::date) f, coalesce((a->>'semesterEnd')::date, '2999-12-31'::date) t,
                 coalesce((a->>'freeAbsences')::int, 1) free, coalesce((a->>'excusedAbsences')::int, 2) extra from st),
  ab as (select at.date, at.status, r.kind, r.status rstatus from public.attendance at cross join sem
         left join public.absence_requests r on r.student_id = at.student_id and r.date = at.date
         where at.student_id = sid and at.status in ('absent', 'excused') and at.date between sem.f and sem.t)
  select jsonb_build_object(
    'absences', (select count(*) from ab),
    'free', (select free from sem), 'extra', (select extra from sem),
    'unnotified', (select count(*) from ab where kind is null),
    'excused', (select count(*) from ab where kind = 'excuse' and rstatus = 'approved'),
    'over', greatest(0, (select count(*) from ab) - (select free from sem) - least((select count(*) from ab where kind = 'excuse' and rstatus = 'approved'), (select extra from sem)))
  );
$$;
create or replace function public.attendance_standing(sid uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.can_see_student(sid) then raise exception 'Not allowed' using errcode = '42501'; end if;
  return public.attendance_standing_internal(sid);
end $$;

-- after class ends: anyone in the halaqah without a check-in is marked absent (excused if they sent a request)
create or replace function public.mark_absences() returns int
language plpgsql security definer set search_path = public as $$
declare c record; s record; n int := 0; local timestamp; stand jsonb; st_name text;
begin
  for c in select cl.*, (sl->>'end')::time as ends from public.classes cl, jsonb_array_elements(cl.schedule_slots) sl
           where cl.archived_at is null and (sl->>'day')::int = extract(dow from public.org_local_now(cl.org_id))::int loop
    local := public.org_local_now(c.org_id);
    continue when local::time < c.ends + interval '10 minutes';
    for s in select st.id, st.name from public.class_students cs join public.students st on st.id = cs.student_id
             where cs.class_id = c.id and st.archived_at is null
               and not exists (select 1 from public.attendance a where a.student_id = st.id and a.date = local::date) loop
      insert into public.attendance (org_id, student_id, class_id, date, status, note, source, recorded_by_user)
      select c.org_id, s.id, c.id, local::date,
             case when r.id is not null and r.status <> 'declined' then 'excused' else 'absent' end::public.attendance_status,
             case when r.id is null then 'Not communicated before class' else null end, 'auto', null
      from (select 1) x left join public.absence_requests r on r.student_id = s.id and r.date = local::date
      on conflict (student_id, date) do nothing;
      n := n + 1;
      stand := public.attendance_standing_internal(s.id);
      if ((stand->>'unnotified')::int > 0 or (stand->>'over')::int > 0)
         and not exists (select 1 from public.reminders_sent where key = 'attwarn:' || s.id || ':' || local::date) then
        insert into public.reminders_sent (key) values ('attwarn:' || s.id || ':' || local::date);
        perform public.enqueue(u.user_id, 'Attendance warning', s.name || ': ' ||
          case when (stand->>'over')::int > 0 then 'more absences than allowed this semester. Students over the limit may be removed from the class.'
               else 'an absence was not communicated before class. Please always tell the teacher before class.' end, '#/')
        from (select user_id from public.student_audience(s.id) union select user_id from public.staff_of(c.org_id)) u;
      end if;
    end loop;
  end loop;
  return n;
end $$;

-- ------------------------------------------------------------- scheduled reminders (run every 5 minutes by pg_cron)
create or replace function public.week_start(d date) returns date language sql immutable as $$ select d - ((extract(isodow from d)::int) - 1) $$;
create or replace function public.scheduled_reminders() returns int
language plpgsql security definer set search_path = public as $$
declare o record; c record; local timestamp; n int := 0; k text; slot jsonb; wk date; st record; missed int; allowed int; slots jsonb;
begin
  -- class check-in opens
  for c in select cl.*, (sl->>'start')::time as starts from public.classes cl, jsonb_array_elements(cl.schedule_slots) sl
           where cl.archived_at is null and (sl->>'day')::int = extract(dow from public.org_local_now(cl.org_id))::int loop
    local := public.org_local_now(c.org_id);
    if local::time between c.starts - make_interval(mins => c.checkin_open_min) and c.starts + interval '20 minutes' then
      k := 'checkin:' || c.id || ':' || local::date;
      if not exists (select 1 from public.reminders_sent where key = k) then
        insert into public.reminders_sent (key) values (k);
        perform public.enqueue(st2.user_id, c.name || ' starts at ' || to_char(c.starts, 'FMHH12:MI am'), 'Check in when you arrive' || case when c.require_code then ' with today''s code from your teacher.' else '.' end, '#/home')
        from public.class_students cs join public.students st2 on st2.id = cs.student_id where cs.class_id = c.id and st2.user_id is not null;
        n := n + 1;
      end if;
    end if;
  end loop;

  for o in select * from public.organizations where deleted_at is null loop
    local := public.org_local_now(o.id); wk := public.week_start(local::date);
    slots := coalesce(o.settings->'revisionForm'->'slots', '[{"key":"after_lesson","label":"After the lesson at the mosque","day":null},{"key":"wed","label":"Wednesday night","day":3},{"key":"fri","label":"Friday night","day":5}]'::jsonb);
    allowed := coalesce((o.settings->'revisionForm'->>'allowedMisses')::int, 1);
    -- partner revision nights at 7 pm
    for slot in select * from jsonb_array_elements(slots) loop
      if slot->>'day' is not null and (slot->>'day')::int = extract(dow from local)::int and local::time between '19:00' and '19:15' then
        k := 'rev:' || o.id || ':' || local::date || ':' || (slot->>'key');
        if not exists (select 1 from public.reminders_sent where key = k) then
          insert into public.reminders_sent (key) values (k);
          perform public.enqueue(s.user_id, 'Partner revision tonight', (slot->>'label') || ': revise with your partner, then tick it on your weekly form.', '#/home')
          from public.students s where s.org_id = o.id and s.archived_at is null and s.user_id is not null;
          n := n + 1;
        end if;
      end if;
    end loop;
    -- Sunday 6 pm: weekly form reminder for anyone with gaps
    if extract(isodow from local) = 7 and local::time between '18:00' and '18:15' then
      k := 'form:' || o.id || ':' || wk;
      if not exists (select 1 from public.reminders_sent where key = k) then
        insert into public.reminders_sent (key) values (k);
        perform public.enqueue(s.user_id, 'Weekly revision form', 'Please complete this week''s revision form before Monday.', '#/home')
        from public.students s where s.org_id = o.id and s.archived_at is null and s.user_id is not null
          and (select count(*) from public.revision_checkins r where r.student_id = s.id and r.week_start = wk and r.done) < jsonb_array_length(slots);
        n := n + 1;
      end if;
    end if;
    -- Monday 9 am: follow up on last week (missing 2 or more)
    if extract(isodow from local) = 1 and local::time between '09:00' and '09:15' then
      k := 'followup:' || o.id || ':' || wk;
      if not exists (select 1 from public.reminders_sent where key = k) then
        insert into public.reminders_sent (key) values (k);
        for st in select s.id, s.name, s.user_id, jsonb_array_length(slots) - (select count(*) from public.revision_checkins r where r.student_id = s.id and r.week_start = wk - 7 and r.done) as m
                  from public.students s where s.org_id = o.id and s.archived_at is null and s.user_id is not null loop
          missed := st.m;
          if missed > allowed then
            perform public.enqueue(u.user_id, 'Revision follow-up', st.name || ' missed ' || missed || ' partner revision sessions last week.', '#/assignments/revision')
            from public.staff_of(o.id) u;
            perform public.enqueue(u.user_id, 'Missed revision sessions', 'You missed ' || missed || ' partner revision sessions last week. The Sheikh will follow up.', '#/home')
            from public.student_audience(st.id) u;
          end if;
        end loop;
        n := n + 1;
      end if;
    end if;
  end loop;
  return n;
end $$;

-- ------------------------------------------------------------- notifications for things that happen in the app
create or replace function public.notify_event() returns trigger
language plpgsql security definer set search_path = public as $$
declare who uuid := auth.uid(); sname text;
begin
  if tg_table_name = 'announcements' then
    perform public.enqueue(u.user_id, 'Announcement: ' || new.title, coalesce(new.body, ''), '#/')
    from (select m.user_id from public.organization_members m where m.org_id = new.org_id
          and (new.class_id is null or m.role in ('admin', 'teacher') or m.user_id in (
            select s.user_id from public.class_students cs join public.students s on s.id = cs.student_id where cs.class_id = new.class_id
            union select g.user_id from public.class_students cs join public.student_guardians g on g.student_id = cs.student_id where cs.class_id = new.class_id))) u
    where u.user_id is distinct from who;
  elsif tg_table_name = 'messages' then
    select name into sname from public.students where id = new.student_id;
    perform public.enqueue(u.user_id, coalesce(new.sender_name, 'New message'), new.body, '#/')
    from (select user_id from public.student_audience(new.student_id) union select user_id from public.staff_of(new.org_id)) u
    where u.user_id is distinct from new.sender;
  elsif tg_table_name = 'sessions' then
    if new.recorded_by = 'teacher' and tg_op = 'INSERT' then
      perform public.enqueue(u.user_id, 'Lesson saved', initcap(replace(new.type::text, '_', ' ')) || ': ' || coalesce(public.range_text(new.start_ayah_id, new.end_ayah_id), '') || ' · ' || (new.errors_major + new.errors_minor) || ' mistake(s)', '#/')
      from public.student_audience(new.student_id) u where u.user_id is distinct from who;
    end if;
  elsif tg_table_name = 'assignments' then
    perform public.enqueue(u.user_id, 'New assignment', coalesce(new.instructions, 'Your teacher set new work.') || ' Due ' || to_char(new.due_on, 'Dy DD Mon') || '.', '#/')
    from public.student_audience(new.student_id) u where u.user_id is distinct from who;
  elsif tg_table_name = 'exams' then
    perform public.enqueue(u.user_id, 'Test scheduled: ' || new.title, 'On ' || to_char(new.scheduled_on, 'Dy DD Mon') || '. Revise well.', '#/')
    from public.student_audience(new.student_id) u where u.user_id is distinct from who;
  elsif tg_table_name = 'absence_requests' then
    select name into sname from public.students where id = new.student_id;
    if tg_op = 'INSERT' then
      perform public.enqueue(u.user_id, 'Absence: ' || sname, to_char(new.date, 'Dy DD Mon') || ' · ' || case when new.kind = 'free' then 'free absence' else coalesce(new.reason, 'excuse') end, '#/classes/attendance')
      from public.staff_of(new.org_id) u where u.user_id is distinct from who;
    elsif new.status is distinct from old.status and new.status in ('approved', 'declined') then
      perform public.enqueue(u.user_id, 'Absence ' || new.status, sname || ' · ' || to_char(new.date, 'Dy DD Mon'), '#/')
      from public.student_audience(new.student_id) u where u.user_id is distinct from who;
    end if;
  end if;
  return new;
end $$;
do $$ declare t text; begin
  foreach t in array array['announcements', 'messages', 'sessions', 'assignments', 'exams'] loop
    execute format('drop trigger if exists notify_event on public.%I', t);
    execute format('create trigger notify_event after insert on public.%I for each row execute function public.notify_event()', t);
  end loop;
  drop trigger if exists notify_event on public.absence_requests;
  create trigger notify_event after insert or update on public.absence_requests for each row execute function public.notify_event();
end $$;

-- ------------------------------------------------------------- classmates (revision partners) and site owner tools
create or replace function public.classmates() returns table (student_id uuid, name text, class_name text)
language sql stable security definer set search_path = public as $$
  select distinct s2.id, s2.name, c.name from public.students me
  join public.class_students a on a.student_id = me.id join public.classes c on c.id = a.class_id
  join public.class_students b on b.class_id = a.class_id join public.students s2 on s2.id = b.student_id
  where me.user_id = auth.uid() and s2.id <> me.id and s2.archived_at is null order by s2.name;
$$;
create or replace function public.owner_programs() returns table (id uuid, name text, students bigint, members bigint, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.can_create_programs() then raise exception 'Site owners only' using errcode = '42501'; end if;
  return query select o.id, o.name, (select count(*) from public.students s where s.org_id = o.id and s.archived_at is null),
    (select count(*) from public.organization_members m where m.org_id = o.id), o.created_at from public.organizations o where o.deleted_at is null order by o.created_at;
end $$;
create or replace function public.owner_list() returns table (email text, added_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.can_create_programs() then raise exception 'Site owners only' using errcode = '42501'; end if;
  return query select u.email::text, p.added_at from public.platform_owners p join auth.users u on u.id = p.user_id where p.revoked_at is null order by p.added_at;
end $$;
alter table public.platform_owners add column if not exists revoked_at timestamptz;
create or replace function public.can_create_programs() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.platform_owners where user_id = auth.uid() and revoked_at is null);
$$;
create or replace function public.owner_set(p_email text, p_add boolean) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  if not public.can_create_programs() then raise exception 'Site owners only' using errcode = '42501'; end if;
  select id into uid from auth.users where lower(email) = lower(trim(p_email));
  if uid is null then raise exception 'No account with that email yet. Ask them to create an account first.' using errcode = 'P0002'; end if;
  if p_add then insert into public.platform_owners (user_id) values (uid) on conflict (user_id) do update set revoked_at = null;
  else
    if uid = auth.uid() then raise exception 'You cannot remove yourself' using errcode = '42501'; end if;
    update public.platform_owners set revoked_at = now() where user_id = uid;
  end if;
end $$;

do $$ declare f text; begin
  foreach f in array array['public.org_local_now(uuid)', 'public.class_slot_today(uuid)', 'public.enqueue(uuid, text, text, text)', 'public.student_audience(uuid)', 'public.staff_of(uuid)',
    'public.range_text(integer, integer)', 'public.attendance_standing_internal(uuid)', 'public.mark_absences()', 'public.scheduled_reminders()', 'public.notify_event()'] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
  foreach f in array array['public.class_checkin_code(uuid)', 'public.student_check_in(uuid, text, text)', 'public.request_absence(jsonb)', 'public.attendance_standing(uuid)',
    'public.classmates()', 'public.owner_programs()', 'public.owner_list()', 'public.owner_set(text, boolean)'] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
