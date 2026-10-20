-- Revision at the student's own time: settings.revision.perWeek (e.g. 3) instead of fixed days.
-- Reminders go out on Monday and only when the week's revisions are at risk; weekly reports and the
-- consistency leaderboard count against perWeek. New lessons follow each halaqah's own class day (front end).
create or replace function public.rev_per_week(s jsonb) returns int language sql immutable set search_path = public as $$
  select nullif(least(greatest(coalesce((s->'revision'->>'perWeek')::int, 0), 0), 7), 0);
$$;
create or replace function public.old_days_this_week(p_student uuid, d date) returns int language sql stable security definer set search_path = public as $$
  select count(distinct x.date)::int from public.sessions x where x.student_id = p_student and x.deleted_at is null and x.type in ('old', 'juz_revision')
    and x.check_status is distinct from 'redo' and x.date between public.week_start(d) and d;
$$;
-- at risk: the revisions still needed this week would fill every day that is left (or it is Monday and nothing is done yet)
create or replace function public.revision_at_risk(p_student uuid, d date, per_week int, monday_nudge boolean) returns boolean language sql stable security definer set search_path = public as $$
  select case when public.old_days_this_week(p_student, d) >= per_week then false
              when monday_nudge then true
              else (per_week - public.old_days_this_week(p_student, d)) >= (8 - extract(isodow from d)::int) - 1 end;
$$;
revoke all on function public.old_days_this_week(uuid, date) from public, anon, authenticated;
revoke all on function public.revision_at_risk(uuid, date, int, boolean) from public, anon, authenticated;

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
       and (public.rev_per_week(o.settings) is not null or extract(dow from local)::int in (select x::int from jsonb_array_elements_text(coalesce(o.settings->'revision'->'days', '[0,1,2,3,4,5,6]'::jsonb)) x))
       and local::time between rtime and rtime + interval '15 minutes' then
      k := 'old:' || o.id || ':' || local::date;
      if not exists (select 1 from public.reminders_sent where key = k) then
        insert into public.reminders_sent (key) values (k);
        if public.rev_per_week(o.settings) is null then
        perform public.enqueue(s.user_id, 'Revision day today', 'Revise your Old pages today (open Hifz to see which), and read your Recent lessons. Then tap "I revised this".', '#/home')
        from public.students s where s.org_id = o.id and s.archived_at is null and s.user_id is not null;
        else
        -- own time: a Monday nudge, then only when the week's revisions are at risk
        perform public.enqueue(s.user_id, 'Old revision this week', public.old_days_this_week(s.id, local::date) || ' of ' || public.rev_per_week(o.settings) || ' done. Pick a time today to revise with your partner.', '#/home')
        from public.students s where s.org_id = o.id and s.archived_at is null and s.user_id is not null
          and public.revision_at_risk(s.id, local::date, public.rev_per_week(o.settings), extract(isodow from local) = 1);
        end if;
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

create or replace function public.revision_log_reminders() returns int
language plpgsql security definer set search_path = public as $$
declare o record; local timestamp; t time; k text; n int := 0; ws date; on_ boolean;
begin
  for o in select * from public.organizations where deleted_at is null loop
    local := public.org_local_now(o.id);
    on_ := coalesce((o.settings->'revision'->>'logRemind')::boolean, true);
    if not on_ then continue; end if;
    t := coalesce(nullif(o.settings->'revision'->>'logReminderTime', ''), '20:30')::time;
    -- revision day, evening: nothing logged today
    if (public.rev_per_week(o.settings) is not null or extract(dow from local)::int in (select x::int from jsonb_array_elements_text(coalesce(o.settings->'revision'->'days', '[0,1,2,3,4,5,6]'::jsonb)) x))
       and local::time between t and t + interval '15 minutes' then
      k := 'log:' || o.id || ':' || local::date;
      if not exists (select 1 from public.reminders_sent where key = k) then
        insert into public.reminders_sent (key) values (k);
        perform public.enqueue(s.user_id, 'Did you do today’s revision?', 'Log your Old revision in Hifz so your teacher can sign it off.', '#/home')
        from public.students s where s.org_id = o.id and s.archived_at is null and s.user_id is not null
          and not exists (select 1 from public.sessions x where x.student_id = s.id and x.date = local::date and x.type in ('old', 'juz_revision') and x.deleted_at is null)
          and (public.rev_per_week(o.settings) is null or public.revision_at_risk(s.id, local::date, public.rev_per_week(o.settings), false));
        n := n + 1;
      end if;
    end if;
    -- Sunday 7 pm: the week's total
    if extract(isodow from local) = 7 and local::time between '19:00' and '19:15' then
      ws := public.week_start(local::date);
      k := 'weeklog:' || o.id || ':' || ws;
      if not exists (select 1 from public.reminders_sent where key = k) then
        insert into public.reminders_sent (key) values (k);
        perform public.enqueue(s.user_id, 'Your revision this week',
          'You logged ' || coalesce((select count(distinct q.page) from public.sessions x join public.quran_ayahs q on q.id between x.start_ayah_id and x.end_ayah_id
            where x.student_id = s.id and x.date between ws and local::date and x.type in ('old', 'juz_revision') and x.deleted_at is null and x.check_status is distinct from 'redo'), 0)
          || ' Old revision pages. Log anything missing before Monday.', '#/home')
        from public.students s where s.org_id = o.id and s.archived_at is null and s.user_id is not null;
        n := n + 1;
      end if;
    end if;
  end loop;
  return n;
end $$;

create or replace function public.weekly_reports() returns int
language plpgsql security definer set search_path = public as $$
declare o record; local timestamp; k text; n int := 0; ws date; st record; t time; days int[]; mode text;
  logged int; total int; missing text; waiting int; partner_wait int; behind int;
begin
  for o in select * from public.organizations where deleted_at is null loop
    local := public.org_local_now(o.id);
    days := array(select x::int from jsonb_array_elements_text(coalesce(o.settings->'revision'->'days', '[0,1,2,3,4,5,6]'::jsonb)) x);
    -- parents: Sunday 6 pm
    if coalesce((o.settings->'reports'->>'parentWeekly')::boolean, true) and extract(isodow from local) = 7 and local::time between '18:00' and '18:15' then
      ws := public.week_start(local::date); k := 'parentweek:' || o.id || ':' || ws;
      if not exists (select 1 from public.reminders_sent where key = k) then
        insert into public.reminders_sent (key) values (k);
        for st in select s.id, s.name from public.students s where s.org_id = o.id and s.archived_at is null loop
          perform public.enqueue(g.user_id, split_part(st.name, ' ', 1) || '’s week',
            (select count(distinct q.page) from public.sessions x join public.quran_ayahs q on q.id between x.start_ayah_id and x.end_ayah_id
               where x.student_id = st.id and x.date between ws and local::date and x.type in ('old', 'juz_revision') and x.deleted_at is null and x.check_status is distinct from 'redo')
            || ' Old revision pages · ' ||
            (select count(*) from public.sessions x where x.student_id = st.id and x.date between ws and local::date and x.type = 'new' and x.deleted_at is null and (not x.self_logged or x.check_status = 'ok'))
            || ' new lesson(s) · present ' ||
            (select count(*) from public.attendance a where a.student_id = st.id and a.date between ws and local::date and a.status in ('present', 'late')) || ' time(s)'
            || coalesce(' · Teacher: “' || left((select x.teacher_note from public.sessions x where x.student_id = st.id and x.date between ws and local::date and x.teacher_note is not null order by x.date desc limit 1), 80) || '”', ''),
            '#/child')
          from public.student_guardians g where g.student_id = st.id;
        end loop;
        n := n + 1;
      end if;
    end if;
    -- teachers: Monday 8 am, last week
    if coalesce((o.settings->'reports'->>'teacherWeekly')::boolean, true) and extract(isodow from local) = 1 and local::time between '08:00' and '08:15' then
      ws := public.week_start(local::date) - 7; k := 'teacherweek:' || o.id || ':' || ws;
      if not exists (select 1 from public.reminders_sent where key = k) then
        insert into public.reminders_sent (key) values (k);
        total := coalesce(public.rev_per_week(o.settings), (select count(*) from generate_series(ws, ws + 6, interval '1 day') g where extract(dow from g)::int = any (days)));
        select count(*) filter (where c < total), string_agg(name, ', ' order by c) filter (where c < total)
          into behind, missing
        from (select s.name, (select count(distinct x.date) from public.sessions x where x.student_id = s.id and x.date between ws and ws + 6 and x.type in ('old', 'juz_revision') and x.deleted_at is null) as c
              from public.students s where s.org_id = o.id and s.archived_at is null) q;
        select count(*) into waiting from public.sessions x where x.org_id = o.id and x.type = 'new' and x.self_logged and x.check_status is null and x.deleted_at is null;
        select count(*) into partner_wait from public.sessions x where x.org_id = o.id and x.partner_status = 'pending' and x.deleted_at is null;
        perform public.enqueue(u.user_id, 'Last week in ' || o.name,
          coalesce(behind, 0) || ' student(s) missed revision days' || coalesce(' (' || left(missing, 120) || ')', '') || ' · ' || waiting || ' new lesson(s) to sign off · ' || partner_wait || ' partner check(s) pending', '#/today')
        from public.staff_of(o.id) u;
        n := n + 1;
      end if;
    end if;
    -- teachers: daily revision digest an hour after the students' log reminder, on revision days
    mode := coalesce(o.settings->'revision'->>'teacherNotify', 'daily');
    t := coalesce(nullif(o.settings->'revision'->>'logReminderTime', ''), '20:30')::time + interval '1 hour';
    if mode = 'daily' and (public.rev_per_week(o.settings) is not null or extract(dow from local)::int = any (days)) and local::time between t and t + interval '15 minutes' then
      k := 'revdigest:' || o.id || ':' || local::date;
      if not exists (select 1 from public.reminders_sent where key = k) then
        insert into public.reminders_sent (key) values (k);
        select count(distinct x.student_id) into logged from public.sessions x where x.org_id = o.id and x.date = local::date and x.type in ('old', 'recent', 'juz_revision') and x.deleted_at is null;
        select count(*) into total from public.students s where s.org_id = o.id and s.archived_at is null;
        perform public.enqueue(u.user_id, 'Revision today', logged || ' of ' || total || ' students logged revision · ' ||
          (select count(*) from public.sessions x where x.org_id = o.id and x.date = local::date and x.partner_status = 'confirmed') || ' confirmed by partners', '#/today')
        from public.staff_of(o.id) u;
        n := n + 1;
      end if;
    end if;
  end loop;
  return n;
end $$;

create or replace function public.revision_consistency(org uuid, p_weeks int default 4)
returns table (student_id uuid, display_name text, days_due int, days_done int, partner_checked int, percent int, is_me boolean)
language plpgsql stable security definer set search_path = public as $$
declare lb jsonb; staff boolean; today date; days int[]; due int; pw int;
begin
  if not public.is_member(org) then raise exception 'Not a member of this program' using errcode = '42501'; end if;
  staff := public.is_staff(org);
  lb := '{"enabled":false,"fullNames":false}'::jsonb || coalesce((select settings->'leaderboard' from public.organizations where id = org), '{}');
  if not staff and not (lb->>'enabled')::boolean then raise exception 'The leaderboard is turned off' using errcode = '42501'; end if;
  today := public.org_today(org); p_weeks := least(greatest(coalesce(p_weeks, 4), 1), 12);
  days := array(select x::int from jsonb_array_elements_text(coalesce((select settings->'revision'->'days' from public.organizations where id = org), '[0,1,2,3,4,5,6]'::jsonb)) x);
  pw := public.rev_per_week((select settings from public.organizations where id = org));
  due := coalesce(pw * p_weeks, (select count(*) from generate_series(today - (p_weeks * 7 - 1), today, interval '1 day') g where extract(dow from g)::int = any (days)));
  return query
  select st.id,
    case when staff or (lb->>'fullNames')::boolean or st.user_id = auth.uid() then st.name
         else split_part(st.name, ' ', 1) || coalesce(' ' || nullif(left(split_part(st.name, ' ', 2), 1), '') || '.', '') end,
    due,
    (select least(count(distinct x.date)::int, due) from public.sessions x where x.student_id = st.id and x.deleted_at is null and x.type in ('old', 'juz_revision')
       and x.check_status is distinct from 'redo' and x.date between today - (p_weeks * 7 - 1) and today and (pw is not null or extract(dow from x.date)::int = any (days))),
    (select count(*)::int from public.sessions x where x.student_id = st.id and x.deleted_at is null and x.partner_status = 'confirmed' and x.date between today - (p_weeks * 7 - 1) and today),
    0, (st.user_id = auth.uid() or exists (select 1 from public.student_guardians g where g.student_id = st.id and g.user_id = auth.uid()))
  from public.students st where st.org_id = org and st.archived_at is null;
end $$;
