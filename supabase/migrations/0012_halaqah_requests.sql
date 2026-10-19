-- Halaqah join requests (students ask, teachers approve) and Old-revision-day reminders.
create table if not exists public.class_join_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined', 'cancelled')),
  note text check (char_length(note) <= 300),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid
);
create unique index if not exists class_join_one_pending on public.class_join_requests (class_id, student_id) where status = 'pending';
create index if not exists class_join_org on public.class_join_requests (org_id, status);
alter table public.class_join_requests enable row level security;
revoke all on public.class_join_requests from anon;
grant select on public.class_join_requests to authenticated;
create policy class_join_read on public.class_join_requests for select to authenticated using (public.is_staff(org_id) or public.can_see_student(student_id));

-- A student (or their parent) asks to join a halaqah. p_student null = the signed-in student.
create or replace function public.request_class_join(p_class uuid, p_student uuid default null, p_note text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare c public.classes; s public.students; rid uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  select * into c from public.classes where id = p_class and archived_at is null;
  if not found then raise exception 'That halaqah was not found' using errcode = 'P0002'; end if;
  if p_student is null then
    select * into s from public.students where user_id = auth.uid() and org_id = c.org_id and archived_at is null limit 1;
  else
    select * into s from public.students where id = p_student and org_id = c.org_id and archived_at is null
      and (user_id = auth.uid() or exists (select 1 from public.student_guardians g where g.student_id = p_student and g.user_id = auth.uid()));
  end if;
  if s.id is null then raise exception 'Only the student or their parent can ask to join' using errcode = '42501'; end if;
  if exists (select 1 from public.class_students where class_id = c.id and student_id = s.id) then raise exception 'You are already in this halaqah' using errcode = '23505'; end if;
  select id into rid from public.class_join_requests where class_id = c.id and student_id = s.id and status = 'pending';
  if rid is not null then return rid; end if;
  insert into public.class_join_requests (org_id, class_id, student_id, note) values (c.org_id, c.id, s.id, nullif(trim(p_note), '')) returning id into rid;
  return rid;
end $$;

create or replace function public.cancel_class_join(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.class_join_requests r set status = 'cancelled', decided_at = now(), decided_by = auth.uid()
  where r.id = p_id and r.status = 'pending' and exists (select 1 from public.students s where s.id = r.student_id
    and (s.user_id = auth.uid() or exists (select 1 from public.student_guardians g where g.student_id = s.id and g.user_id = auth.uid())));
  if not found then raise exception 'That request cannot be cancelled' using errcode = '42501'; end if;
end $$;

-- Teacher approves (adds the student to the halaqah) or declines.
create or replace function public.decide_class_join(p_id uuid, p_approve boolean) returns void
language plpgsql security definer set search_path = public as $$
declare r public.class_join_requests;
begin
  select * into r from public.class_join_requests where id = p_id;
  if not found or not public.is_staff(r.org_id) then raise exception 'Teachers only' using errcode = '42501'; end if;
  if r.status <> 'pending' then return; end if;
  if p_approve then insert into public.class_students (class_id, student_id, org_id) values (r.class_id, r.student_id, r.org_id) on conflict do nothing; end if;
  update public.class_join_requests set status = case when p_approve then 'approved' else 'declined' end, decided_at = now(), decided_by = auth.uid() where id = p_id;
end $$;

create or replace function public.scheduled_reminders() returns int
language plpgsql security definer set search_path = public as $$
declare o record; c record; local timestamp; rtime time; n int := 0; k text; slot jsonb; wk date; st record; missed int; allowed int; slots jsonb;
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
    -- Old revision days (settings.revision.days, e.g. Mon/Wed/Fri) at settings.revision.reminderTime (default 3 pm)
    rtime := coalesce(nullif(o.settings->'revision'->>'reminderTime', ''), '15:00')::time;
    if coalesce((o.settings->'revision'->>'remind')::boolean, true)
       and extract(dow from local)::int in (select x::int from jsonb_array_elements_text(coalesce(o.settings->'revision'->'days', '[0,1,2,3,4,5,6]'::jsonb)) x)
       and local::time between rtime and rtime + interval '15 minutes' then
      k := 'old:' || o.id || ':' || local::date;
      if not exists (select 1 from public.reminders_sent where key = k) then
        insert into public.reminders_sent (key) values (k);
        perform public.enqueue(s.user_id, 'Revision day today', 'Revise your Old pages today (open Hifz to see which), and read your Recent lessons. Then tap "I revised this".', '#/home')
        from public.students s where s.org_id = o.id and s.archived_at is null and s.user_id is not null;
        n := n + 1;
      end if;
    end if;
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

create or replace function public.notify_event() returns trigger
language plpgsql security definer set search_path = public as $$
declare who uuid := auth.uid(); sname text; cname text;
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
  elsif tg_table_name = 'class_join_requests' then
    select name into sname from public.students where id = new.student_id;
    select name into cname from public.classes where id = new.class_id;
    if tg_op = 'INSERT' then
      perform public.enqueue(u.user_id, 'Halaqah request', sname || ' wants to join ' || cname || '. Tap to approve.', '#/classes/halaqahs')
      from public.staff_of(new.org_id) u where u.user_id is distinct from who;
    elsif new.status is distinct from old.status and new.status in ('approved', 'declined') then
      perform public.enqueue(u.user_id, case when new.status = 'approved' then 'Welcome to ' || cname else 'Halaqah request declined' end,
        case when new.status = 'approved' then sname || ' is now in ' || cname || '.' else sname || ' was not added to ' || cname || '. Ask your teacher if you have questions.' end, '#/home')
      from public.student_audience(new.student_id) u where u.user_id is distinct from who;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists notify_event on public.class_join_requests;
create trigger notify_event after insert or update on public.class_join_requests for each row execute function public.notify_event();

revoke all on function public.scheduled_reminders() from public, anon, authenticated;
revoke all on function public.notify_event() from public, anon, authenticated;
revoke all on function public.request_class_join(uuid, uuid, text) from public, anon;
revoke all on function public.cancel_class_join(uuid) from public, anon;
revoke all on function public.decide_class_join(uuid, boolean) from public, anon;
grant execute on function public.request_class_join(uuid, uuid, text) to authenticated;
grant execute on function public.cancel_class_join(uuid) to authenticated;
grant execute on function public.decide_class_join(uuid, boolean) to authenticated;
