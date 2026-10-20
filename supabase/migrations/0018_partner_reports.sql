-- Revision partners confirm each other's revision (with mistakes by ayah); the teacher just sees and is told.
-- Plus: weak ayahs, automatic juzʾ test booking, parent and teacher weekly summaries, a revision-consistency board.

alter table public.sessions add column if not exists partner_student_id uuid; -- a student id (no foreign key, so archiving or removing a partner never blocks)
alter table public.sessions add column if not exists partner_status text check (partner_status in ('pending', 'confirmed'));
alter table public.sessions add column if not exists partner_confirmed_at timestamptz;

-- 1. the student asks a classmate to confirm a revision they logged
create or replace function public.request_partner_check(p_session uuid, p_partner uuid) returns void
language plpgsql security definer set search_path = public as $$
declare s public.sessions; me public.students; pt public.students;
begin
  select * into s from public.sessions where id = p_session and deleted_at is null;
  select * into me from public.students where id = s.student_id;
  if s.id is null or me.user_id is distinct from auth.uid() then raise exception 'Only the student can ask a partner' using errcode = '42501'; end if;
  if s.type not in ('old', 'recent', 'juz_revision', 'review') then raise exception 'Partners check revision only' using errcode = '22023'; end if;
  select * into pt from public.students where id = p_partner and org_id = me.org_id and archived_at is null and id <> me.id;
  if not found then raise exception 'Choose a classmate from your program' using errcode = '22023'; end if;
  update public.sessions set partner_student_id = pt.id, partner_status = 'pending', partner_confirmed_at = null where id = s.id;
  if pt.user_id is not null then
    perform public.enqueue(pt.user_id, 'Confirm ' || split_part(me.name, ' ', 1) || '’s revision',
      initcap(replace(s.type::text, '_', ' ')) || ': ' || coalesce(public.range_text(s.start_ayah_id, s.end_ayah_id), '') || '. Tap to note any mistakes.', '#/home');
  end if;
end $$;

-- revisions waiting for me to confirm as a partner
create or replace function public.partner_requests() returns table (session_id uuid, student_name text, type text, start_ayah_id int, end_ayah_id int, date date, student_note text)
language sql stable security definer set search_path = public as $$
  select s.id, st.name, s.type::text, s.start_ayah_id::int, s.end_ayah_id::int, s.date, s.student_note
  from public.sessions s join public.students st on st.id = s.student_id join public.students me on me.id = s.partner_student_id
  where me.user_id = auth.uid() and s.partner_status = 'pending' and s.deleted_at is null and s.date >= current_date - 14
  order by s.date, st.name;
$$;

-- the partner confirms, noting mistakes (optionally on exact ayahs)
create or replace function public.partner_confirm(p_session uuid, p jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare s public.sessions; me public.students; owner public.students; maj int; mnr int; note text; e jsonb; tagged_maj int := 0; tagged_mnr int := 0;
  cfg jsonb; weak int; fail int; slot_key text; dow int; ws date; slots jsonb; n_pages int; pg record; mode text;
begin
  select * into s from public.sessions where id = p_session and deleted_at is null;
  select * into me from public.students where id = s.partner_student_id;
  if s.id is null or me.user_id is distinct from auth.uid() or s.partner_status is distinct from 'pending' then raise exception 'Nothing to confirm' using errcode = '42501'; end if;
  select * into owner from public.students where id = s.student_id;
  note := nullif(trim(p->>'note'), '');
  for e in select * from jsonb_array_elements(coalesce(p->'errors', '[]'::jsonb)) loop
    if (e->>'ayah_id')::int between s.start_ayah_id and s.end_ayah_id then
      insert into public.session_errors (org_id, session_id, ayah_id, category, severity, note)
      values (s.org_id, s.id, (e->>'ayah_id')::smallint, 'other', coalesce((e->>'severity')::public.error_severity, 'minor'), 'partner');
      if e->>'severity' = 'major' then tagged_maj := tagged_maj + 1; else tagged_mnr := tagged_mnr + 1; end if;
    end if;
  end loop;
  maj := greatest(tagged_maj, least(99, coalesce((p->>'errors_major')::int, 0)));
  mnr := greatest(tagged_mnr, least(99, coalesce((p->>'errors_minor')::int, 0)));
  update public.sessions set errors_major = maj, errors_minor = mnr, partner_status = 'confirmed', partner_confirmed_at = now(),
    check_status = 'ok', checked_at = now(), checked_by = auth.uid(), check_note = note, updated_at = now()
  where id = s.id;
  -- pages with mistakes become weak / due again
  cfg := public.org_settings(s.org_id); weak := (cfg->'revision'->>'weakThreshold')::int; fail := (cfg->'revision'->>'failThreshold')::int;
  select count(distinct page) into n_pages from public.quran_ayahs where id between s.start_ayah_id and s.end_ayah_id;
  for pg in select q.page, (select count(*) from public.session_errors se join public.quran_ayahs qa on qa.id = se.ayah_id where se.session_id = s.id and qa.page = q.page)
                 + ceil(greatest(0, maj + mnr - tagged_maj - tagged_mnr)::numeric / greatest(1, n_pages))::int as errs
            from public.quran_ayahs q where q.id between s.start_ayah_id and s.end_ayah_id group by q.page loop
    if pg.errs >= weak then
      update public.revision_items set interval_days = case when pg.errs >= fail then 1 else interval_days end,
        due_on = case when pg.errs >= fail then s.date + 1 else due_on end, lapses = lapses + case when pg.errs >= fail then 1 else 0 end
      where student_id = s.student_id and page = pg.page;
    end if;
  end loop;
  -- tick the weekly partner revision form: the slot for that weekday, else "after the lesson"
  dow := extract(dow from s.date)::int; ws := public.week_start(s.date);
  slots := coalesce(cfg->'revisionForm'->'slots', '[{"key":"after_lesson","day":null},{"key":"wed","day":3},{"key":"fri","day":5}]'::jsonb);
  select x->>'key' into slot_key from jsonb_array_elements(slots) x where (x->>'day')::int = dow limit 1;
  slot_key := coalesce(slot_key, (select x->>'key' from jsonb_array_elements(slots) x where x->>'day' is null limit 1), 'after_lesson');
  insert into public.revision_checkins (org_id, student_id, week_start, slot, done, partner, pages, note)
  values (s.org_id, s.student_id, ws, slot_key, true, me.name, left(coalesce(public.range_text(s.start_ayah_id, s.end_ayah_id), ''), 120), left(note, 300))
  on conflict (student_id, week_start, slot) do update set done = true, partner = excluded.partner, pages = excluded.pages;
  -- tell the student, and the teacher if they want each one
  perform public.enqueue(u.user_id, split_part(me.name, ' ', 1) || ' confirmed your revision',
    coalesce(public.range_text(s.start_ayah_id, s.end_ayah_id), '') || case when maj + mnr > 0 then ' · ' || (maj + mnr) || ' mistake(s)' else ' · no mistakes' end || coalesce(' · ' || note, ''), '#/home')
  from public.student_audience(s.student_id) u;
  mode := coalesce(cfg->'revision'->>'teacherNotify', 'daily');
  if mode = 'each' then
    perform public.enqueue(u.user_id, owner.name || ': revision confirmed', initcap(replace(s.type::text, '_', ' ')) || ' ' || coalesce(public.range_text(s.start_ayah_id, s.end_ayah_id), '') || ' · partner ' || me.name || ' · ' || (maj + mnr) || ' mistake(s)', '#/students/' || owner.id)
    from public.staff_of(s.org_id) u;
  end if;
end $$;

-- teacher sign-off of a new lesson can now tag mistakes on ayahs (adds rows; the sign-off itself is unchanged)
create or replace function public.tag_session_errors(p_session uuid, p_errors jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare s public.sessions; e jsonb; n int := 0;
begin
  select * into s from public.sessions where id = p_session and deleted_at is null;
  if s.id is null or not public.is_staff(s.org_id) then raise exception 'Teachers only' using errcode = '42501'; end if;
  for e in select * from jsonb_array_elements(coalesce(p_errors, '[]'::jsonb)) loop
    if (e->>'ayah_id')::int between s.start_ayah_id and s.end_ayah_id then
      insert into public.session_errors (org_id, session_id, ayah_id, category, severity, note)
      values (s.org_id, s.id, (e->>'ayah_id')::smallint, 'other', coalesce((e->>'severity')::public.error_severity, 'minor'), 'sign-off');
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;

-- 6. a juzʾ completed through lessons → book a juzʾ test a week later (once per juzʾ)
create or replace function public.book_juz_tests() returns trigger
language plpgsql security definer set search_path = public as $$
declare j int; st public.students; d date; eid uuid;
begin
  if new.source <> 'session' then return new; end if;
  select * into st from public.students where id = new.student_id;
  for j in select distinct juz from public.quran_ayahs where id between new.start_ayah_id and new.end_ayah_id loop
    if not exists (select 1 from public.exams where student_id = st.id and juz = j)
       and (select count(*) from public.quran_ayahs a where a.juz = j) =
           (select count(distinct a.id) from public.quran_ayahs a join public.memorized_ranges r on r.student_id = st.id and a.id between r.start_ayah_id and r.end_ayah_id where a.juz = j) then
      d := public.org_today(st.org_id) + 7;
      insert into public.exams (org_id, student_id, title, juz, start_ayah_id, end_ayah_id, scheduled_on)
      values (st.org_id, st.id, 'Juzʾ ' || j || ' test', j, (select min(id) from public.quran_ayahs where juz = j), (select max(id) from public.quran_ayahs where juz = j), d)
      returning id into eid;
      perform public.enqueue(u.user_id, 'Juzʾ ' || j || ' test booked', st.name || ' finished Juzʾ ' || j || '. Test on ' || to_char(d, 'Dy DD Mon') || ' (change it under Work → Juz tests).', '#/assignments')
      from public.staff_of(st.org_id) u;
    end if;
  end loop;
  return new;
end $$;
create trigger book_juz_tests after insert on public.memorized_ranges for each row execute function public.book_juz_tests();

-- 4 & 8 & daily digest: weekly parent report (Sunday), teacher weekly summary (Monday), teacher daily revision digest
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
        total := (select count(*) from generate_series(ws, ws + 6, interval '1 day') g where extract(dow from g)::int = any (days));
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
    if mode = 'daily' and extract(dow from local)::int = any (days) and local::time between t and t + interval '15 minutes' then
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

-- 5. revision consistency: share of revision days (last N weeks) with Old revision logged
create or replace function public.revision_consistency(org uuid, p_weeks int default 4)
returns table (student_id uuid, display_name text, days_due int, days_done int, partner_checked int, percent int, is_me boolean)
language plpgsql stable security definer set search_path = public as $$
declare lb jsonb; staff boolean; today date; days int[]; due int;
begin
  if not public.is_member(org) then raise exception 'Not a member of this program' using errcode = '42501'; end if;
  staff := public.is_staff(org);
  lb := '{"enabled":false,"fullNames":false}'::jsonb || coalesce((select settings->'leaderboard' from public.organizations where id = org), '{}');
  if not staff and not (lb->>'enabled')::boolean then raise exception 'The leaderboard is turned off' using errcode = '42501'; end if;
  today := public.org_today(org); p_weeks := least(greatest(coalesce(p_weeks, 4), 1), 12);
  days := array(select x::int from jsonb_array_elements_text(coalesce((select settings->'revision'->'days' from public.organizations where id = org), '[0,1,2,3,4,5,6]'::jsonb)) x);
  due := (select count(*) from generate_series(today - (p_weeks * 7 - 1), today, interval '1 day') g where extract(dow from g)::int = any (days));
  return query
  select st.id,
    case when staff or (lb->>'fullNames')::boolean or st.user_id = auth.uid() then st.name
         else split_part(st.name, ' ', 1) || coalesce(' ' || nullif(left(split_part(st.name, ' ', 2), 1), '') || '.', '') end,
    due,
    (select count(distinct x.date)::int from public.sessions x where x.student_id = st.id and x.deleted_at is null and x.type in ('old', 'juz_revision')
       and x.check_status is distinct from 'redo' and x.date between today - (p_weeks * 7 - 1) and today and extract(dow from x.date)::int = any (days)),
    (select count(*)::int from public.sessions x where x.student_id = st.id and x.deleted_at is null and x.partner_status = 'confirmed' and x.date between today - (p_weeks * 7 - 1) and today),
    0, (st.user_id = auth.uid() or exists (select 1 from public.student_guardians g where g.student_id = st.id and g.user_id = auth.uid()))
  from public.students st where st.org_id = org and st.archived_at is null;
end $$;

-- who a student can pick as a revision partner: everyone in the program with an account, classmates first
create or replace function public.revision_partners() returns table (student_id uuid, name text, same_class boolean)
language sql stable security definer set search_path = public as $$
  select o.id, o.name,
    exists (select 1 from public.class_students a join public.class_students b on b.class_id = a.class_id where a.student_id = me.id and b.student_id = o.id)
  from public.students me join public.students o on o.org_id = me.org_id and o.id <> me.id and o.archived_at is null and o.user_id is not null
  where me.user_id = auth.uid() and me.archived_at is null
  order by 3 desc, 2;
$$;
revoke all on function public.revision_partners() from public, anon;
grant execute on function public.revision_partners() to authenticated;
revoke all on function public.request_partner_check(uuid, uuid) from public, anon;
grant execute on function public.request_partner_check(uuid, uuid) to authenticated;
revoke all on function public.partner_requests() from public, anon;
grant execute on function public.partner_requests() to authenticated;
revoke all on function public.partner_confirm(uuid, jsonb) from public, anon;
grant execute on function public.partner_confirm(uuid, jsonb) to authenticated;
revoke all on function public.tag_session_errors(uuid, jsonb) from public, anon;
grant execute on function public.tag_session_errors(uuid, jsonb) to authenticated;
revoke all on function public.revision_consistency(uuid, int) from public, anon;
grant execute on function public.revision_consistency(uuid, int) to authenticated;
revoke all on function public.book_juz_tests() from public, anon, authenticated;
revoke all on function public.weekly_reports() from public, anon, authenticated;
