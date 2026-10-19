-- 0003 · Server functions (run with the caller's identity checked inside), audit triggers.
-- Each function validates its input and runs as one transaction.

create or replace function public.org_settings(org uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'scoreScale', coalesce((s->>'scoreScale')::int, 5),
    'revision', '{"recentDays":7,"maxIntervalDays":30,"weakThreshold":2,"failThreshold":3,"dailyOldPages":null,"maxOverdueBeforeNew":null}'::jsonb || coalesce(s->'revision', '{}'),
    'accuracy', '{"major":10,"minor":3}'::jsonb || coalesce(s->'accuracy', '{}'),
    'email', '{"enabled":true,"onSession":true,"lowRevision":true,"weekly":false}'::jsonb || coalesce(s->'email', '{}'))
  from (select settings as s from public.organizations where id = org) x;
$$;

create or replace function public.org_today(org uuid) returns date
language sql stable security definer set search_path = public as $$
  select (now() at time zone o.timezone)::date from public.organizations o where o.id = org;
$$;

-- ---------------------------------------------------------------- audit
create or replace function public.audit_row() returns trigger
language plpgsql security definer set search_path = public as $$
declare r jsonb := to_jsonb(coalesce(new, old));
begin
  insert into public.audit_logs (org_id, action, entity, entity_id, metadata)
  values ((r->>'org_id')::uuid, lower(tg_op), tg_table_name, coalesce(r->>'id', r->>'user_id'),
          case when tg_op = 'UPDATE' then jsonb_build_object('changed', (select coalesce(jsonb_agg(k), '[]') from jsonb_object_keys(to_jsonb(new)) k where to_jsonb(new)->k is distinct from to_jsonb(old)->k)) else '{}'::jsonb end);
  return coalesce(new, old);
end $$;
do $$ declare t text; begin
  foreach t in array array['students', 'sessions', 'assignments', 'organization_members', 'attendance', 'classes'] loop
    execute format('drop trigger if exists audit on public.%I', t);
    execute format('create trigger audit after insert or update or delete on public.%I for each row execute function public.audit_row()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- organizations
create or replace function public.create_organization(p_name text, p_timezone text default 'America/New_York', p_display_name text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare oid uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  if p_name is null or char_length(trim(p_name)) < 2 then raise exception 'Give the program a name' using errcode = '22023'; end if;
  if not exists (select 1 from pg_timezone_names where name = p_timezone) then raise exception 'Unknown time zone %', p_timezone using errcode = '22023'; end if;
  insert into public.organizations (name, timezone) values (trim(p_name), p_timezone) returning id into oid;
  insert into public.organization_members (org_id, user_id, role, display_name) values (oid, auth.uid(), 'admin', nullif(trim(p_display_name), ''));
  insert into public.subscriptions (org_id) values (oid);
  return oid;
end $$;

-- Join with a code: the student code makes you a student, the teacher code a teacher. Existing members keep their role.
create or replace function public.join_organization(p_code text, p_display_name text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare o public.organizations; r public.member_role; existing public.member_role;
begin
  if auth.uid() is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  select * into o from public.organizations where deleted_at is null and (join_code = upper(trim(p_code)) or teacher_code = upper(trim(p_code)));
  if not found then raise exception 'That code was not found. Check it with your teacher.' using errcode = 'P0002'; end if;
  r := case when o.teacher_code = upper(trim(p_code)) then 'teacher'::public.member_role else 'student'::public.member_role end;
  select role into existing from public.organization_members where org_id = o.id and user_id = auth.uid();
  if found then return jsonb_build_object('org_id', o.id, 'role', existing); end if;
  insert into public.organization_members (org_id, user_id, role, display_name) values (o.id, auth.uid(), r, nullif(trim(p_display_name), ''));
  return jsonb_build_object('org_id', o.id, 'role', r);
end $$;

create or replace function public.regenerate_codes(org uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin(org) then raise exception 'Only an admin can do this' using errcode = '42501'; end if;
  update public.organizations set join_code = upper(substr(md5(random()::text), 1, 6)), teacher_code = upper(substr(md5(random()::text), 1, 8)) where id = org;
end $$;

-- ---------------------------------------------------------------- memorisation helpers
create or replace function public.memorised_pages(sid uuid) returns table (page smallint)
language sql stable security definer set search_path = public as $$
  with mem as (select distinct a.id from public.memorized_ranges r join public.quran_ayahs a on a.id between r.start_ayah_id and r.end_ayah_id where r.student_id = sid)
  select a.page from public.quran_ayahs a left join mem m on m.id = a.id group by a.page having count(*) = count(m.id) order by a.page;
$$;

-- Create revision items for memorised pages that do not have one yet.
-- spread = true (setup): stagger first reviews over a week so they are not all due at once.
create or replace function public.sync_revision_items(sid uuid, org uuid, on_date date, spread boolean) returns void
language sql security definer set search_path = public as $$
  insert into public.revision_items (student_id, page, org_id, interval_days, due_on)
  select sid, p.page, org, case when spread then 7 else 1 end, on_date + case when spread then (p.page % 7) + 1 else 1 end
  from public.memorised_pages(sid) p
  on conflict (student_id, page) do nothing;
$$;

create or replace function public.insert_ranges(sid uuid, org uuid, ranges jsonb, on_date date, src text, sess uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r jsonb; a int; b int;
begin
  for r in select * from jsonb_array_elements(coalesce(ranges, '[]'::jsonb)) loop
    a := (r->>0)::int; b := (r->>1)::int;
    if a is null or b is null or a < 1 or b > 6236 or a > b then raise exception 'Invalid Qur''an range' using errcode = '22023'; end if;
    insert into public.memorized_ranges (org_id, student_id, start_ayah_id, end_ayah_id, memorized_on, source, session_id) values (org, sid, a, b, on_date, src, sess);
  end loop;
end $$;

create or replace function public.refresh_milestones(sid uuid, on_date date) returns void
language plpgsql security definer set search_path = public as $$
declare org uuid; pages int; juz int; sess int; days int;
begin
  select org_id into org from public.students where id = sid;
  select count(*) into pages from public.memorised_pages(sid);
  with mem as (select distinct a.id from public.memorized_ranges r join public.quran_ayahs a on a.id between r.start_ayah_id and r.end_ayah_id where r.student_id = sid)
  select count(*) into juz from (select a.juz from public.quran_ayahs a left join mem m on m.id = a.id group by a.juz having count(*) = count(m.id)) j;
  select count(*), count(distinct date) into sess, days from public.sessions where student_id = sid and deleted_at is null;
  insert into public.milestones (student_id, code, org_id, achieved_on)
  select sid, c, org, on_date from (values
    ('first_page', pages >= 1), ('juz_1', juz >= 1), ('juz_5', juz >= 5), ('juz_10', juz >= 10), ('juz_15', juz >= 15),
    ('juz_20', juz >= 20), ('juz_25', juz >= 25), ('quran_complete', juz >= 30), ('sessions_100', sess >= 100), ('days_365', days >= 365)) v(c, ok)
  where ok
  on conflict (student_id, code) do nothing;
end $$;

-- ---------------------------------------------------------------- students
-- p: org_id, name, age_group, direction, daily_new_ayahs, goal, guardian_name, guardian_email, notify, memorized: [[start,end],…], for_self (bool)
create or replace function public.create_student(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare org uuid := (p->>'org_id')::uuid; self boolean := coalesce((p->>'for_self')::boolean, false); sid uuid; today date;
begin
  if auth.uid() is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  if self then
    if not public.has_role(org, array['student']::public.member_role[]) then raise exception 'Join the program with its code first' using errcode = '42501'; end if;
    if exists (select 1 from public.students where org_id = org and user_id = auth.uid()) then raise exception 'You already have a tracker in this program' using errcode = '23505'; end if;
  elsif not public.is_staff(org) then raise exception 'Only a teacher can add students' using errcode = '42501';
  end if;
  today := public.org_today(org);
  insert into public.students (org_id, user_id, name, age_group, direction, daily_new_ayahs, goal, guardian_name, guardian_email, notify, start_date)
  values (org, case when self then auth.uid() end, trim(p->>'name'), nullif(p->>'age_group', ''), coalesce(p->>'direction', 'back'),
          coalesce((p->>'daily_new_ayahs')::smallint, 3), nullif(trim(p->>'goal'), ''), nullif(trim(p->>'guardian_name'), ''),
          nullif(lower(trim(p->>'guardian_email')), ''), coalesce((p->>'notify')::boolean, true), today)
  returning id into sid;
  perform public.insert_ranges(sid, org, p->'memorized', today, 'setup', null);
  perform public.sync_revision_items(sid, org, today, true);
  perform public.refresh_milestones(sid, today);
  return sid;
end $$;

-- ---------------------------------------------------------------- sessions
-- p: student_id, date?, type, start_ayah_id, end_ayah_id, errors_major?, errors_minor?, errors: [{ayah_id?, category, severity?, note?}],
--    scores: {tajweed, fluency, accuracy, tarteel, overall}, attendance?, mode?, teacher_note?, student_note?, follow_up?
create or replace function public.record_session(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  st public.students; who public.recorder; t public.session_type := (p->>'type')::public.session_type;
  a smallint := (p->>'start_ayah_id')::smallint; b smallint := (p->>'end_ayah_id')::smallint;
  d date; today date; cfg jsonb; scale int; lo int; k text; v numeric; sid uuid; prev public.recorder;
  e jsonb; n_major int := 0; n_minor int := 0; tagged int := 0; untagged int; n_pages int; share int;
  weak int; fail int; maxi int;
begin
  select * into st from public.students where id = (p->>'student_id')::uuid;
  if not found or st.archived_at is not null then raise exception 'Student not found' using errcode = 'P0002'; end if;
  if public.is_staff(st.org_id) then who := 'teacher';
  elsif st.user_id = auth.uid() then
    who := 'student';
    if t not in ('recent', 'old', 'review', 'juz_revision') then raise exception 'Students can record their own revision only' using errcode = '42501'; end if;
    if p->'scores' is not null and jsonb_strip_nulls(p->'scores') <> '{}'::jsonb then raise exception 'Only a teacher can give scores' using errcode = '42501'; end if;
    if nullif(p->>'teacher_note', '') is not null then raise exception 'Only a teacher can write a teacher note' using errcode = '42501'; end if;
  else raise exception 'Not allowed' using errcode = '42501';
  end if;

  if a is null or b is null or a < 1 or b > 6236 or a > b then raise exception 'Invalid Qur''an range' using errcode = '22023'; end if;
  today := public.org_today(st.org_id);
  d := coalesce((p->>'date')::date, today);
  if d > today or d < today - 366 then raise exception 'The date must be within the last year and not in the future' using errcode = '22023'; end if;

  cfg := public.org_settings(st.org_id);
  scale := (cfg->>'scoreScale')::int; lo := case when scale = 5 then 1 else 0 end;
  foreach k in array array['tajweed', 'fluency', 'accuracy', 'tarteel', 'overall'] loop
    v := (p->'scores'->>k)::numeric;
    if v is not null and (v < lo or v > scale) then raise exception 'Score % must be between % and %', k, lo, scale using errcode = '22023'; end if;
  end loop;

  for e in select * from jsonb_array_elements(coalesce(p->'errors', '[]'::jsonb)) loop
    if (e->>'ayah_id') is not null and ((e->>'ayah_id')::int < a or (e->>'ayah_id')::int > b) then raise exception 'An error is outside the recited range' using errcode = '22023'; end if;
    if coalesce(e->>'severity', 'minor') = 'major' then n_major := n_major + 1; else n_minor := n_minor + 1; end if;
  end loop;
  n_major := greatest(n_major, coalesce((p->>'errors_major')::int, 0));
  n_minor := greatest(n_minor, coalesce((p->>'errors_minor')::int, 0));

  select recorded_by into prev from public.sessions where student_id = st.id and date = d and type = t and start_ayah_id = a;
  if found and prev = 'teacher' and who = 'student' then raise exception 'Your teacher already recorded this; ask them to change it' using errcode = '42501'; end if;

  insert into public.sessions as s (org_id, student_id, date, type, start_ayah_id, end_ayah_id, errors_major, errors_minor,
    score_tajweed, score_fluency, score_accuracy, score_tarteel, score_overall, attendance, mode, teacher_note, student_note, follow_up, recorded_by, recorded_by_user)
  values (st.org_id, st.id, d, t, a, b, n_major, n_minor,
    (p->'scores'->>'tajweed')::numeric, (p->'scores'->>'fluency')::numeric, (p->'scores'->>'accuracy')::numeric, (p->'scores'->>'tarteel')::numeric, (p->'scores'->>'overall')::numeric,
    coalesce((p->>'attendance')::public.attendance_status, 'present'), coalesce((p->>'mode')::public.attendance_mode, 'in_person'),
    nullif(trim(p->>'teacher_note'), ''), nullif(trim(p->>'student_note'), ''), coalesce((p->>'follow_up')::boolean, false), who, auth.uid())
  on conflict (student_id, date, type, start_ayah_id) do update set
    end_ayah_id = excluded.end_ayah_id, errors_major = excluded.errors_major, errors_minor = excluded.errors_minor,
    score_tajweed = excluded.score_tajweed, score_fluency = excluded.score_fluency, score_accuracy = excluded.score_accuracy,
    score_tarteel = excluded.score_tarteel, score_overall = excluded.score_overall, attendance = excluded.attendance, mode = excluded.mode,
    teacher_note = case when excluded.recorded_by = 'teacher' then excluded.teacher_note else s.teacher_note end,
    student_note = coalesce(excluded.student_note, s.student_note), follow_up = excluded.follow_up,
    recorded_by = excluded.recorded_by, recorded_by_user = excluded.recorded_by_user, updated_at = now(), deleted_at = null
  returning id into sid;

  delete from public.session_errors where session_id = sid;
  insert into public.session_errors (org_id, session_id, ayah_id, category, severity, note)
  select st.org_id, sid, (x->>'ayah_id')::smallint, (x->>'category')::public.error_category, coalesce((x->>'severity')::public.error_severity, 'minor'), nullif(x->>'note', '')
  from jsonb_array_elements(coalesce(p->'errors', '[]'::jsonb)) x;

  if t = 'new' then
    delete from public.memorized_ranges where session_id = sid;
    perform public.insert_ranges(st.id, st.org_id, jsonb_build_array(jsonb_build_array(a, b)), d, 'session', sid);
    perform public.sync_revision_items(st.id, st.org_id, d, false);
  else
    -- per-page review update: errors tagged to an ayah count on its page; untagged errors are shared across the pages recited
    weak := (cfg->'revision'->>'weakThreshold')::int; fail := (cfg->'revision'->>'failThreshold')::int; maxi := (cfg->'revision'->>'maxIntervalDays')::int;
    select count(*) into tagged from public.session_errors where session_id = sid and ayah_id is not null;
    select count(distinct page) into n_pages from public.quran_ayahs where id between a and b;
    untagged := greatest(0, n_major + n_minor - tagged);
    share := case when untagged = 0 then 0 else ceil(untagged::numeric / n_pages)::int end;
    with pg as (
      select q.page, share + coalesce((select count(*) from public.session_errors se join public.quran_ayahs qa on qa.id = se.ayah_id where se.session_id = sid and qa.page = q.page), 0) as errs
      from public.quran_ayahs q where q.id between a and b group by q.page),
    calc as (
      select ri.page, pg.errs,
        case when pg.errs >= fail then 1 when pg.errs >= weak then ri.interval_days else least(ri.interval_days * 2, maxi) end as next_interval
      from public.revision_items ri join pg on pg.page = ri.page where ri.student_id = st.id)
    update public.revision_items ri set
      last_reviewed_on = d, interval_days = calc.next_interval, due_on = d + calc.next_interval,
      lapses = ri.lapses + case when calc.errs >= fail then 1 else 0 end
    from calc where ri.student_id = st.id and ri.page = calc.page and (ri.last_reviewed_on is null or ri.last_reviewed_on <= d);
  end if;

  if who = 'teacher' then
    insert into public.attendance (org_id, student_id, date, status, mode)
    values (st.org_id, st.id, d, coalesce((p->>'attendance')::public.attendance_status, 'present'), coalesce((p->>'mode')::public.attendance_mode, 'in_person'))
    on conflict (student_id, date) do update set status = excluded.status, mode = excluded.mode;
  end if;

  perform public.refresh_milestones(st.id, d);
  return sid;
end $$;

-- Soft delete; a deleted "new" session no longer counts as memorised.
create or replace function public.delete_session(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare s public.sessions;
begin
  select * into s from public.sessions where id = p_id;
  if not found then raise exception 'Session not found' using errcode = 'P0002'; end if;
  if not (public.is_staff(s.org_id) or (s.recorded_by = 'student' and exists (select 1 from public.students x where x.id = s.student_id and x.user_id = auth.uid()))) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  update public.sessions set deleted_at = now(), updated_at = now() where id = p_id;
  delete from public.memorized_ranges where session_id = p_id;
end $$;

-- Students may mark their own assignments started or completed; teachers set anything.
create or replace function public.set_assignment_status(p_id uuid, p_status public.assignment_status, p_feedback text default null) returns void
language plpgsql security definer set search_path = public as $$
declare x public.assignments; mine boolean;
begin
  select * into x from public.assignments where id = p_id;
  if not found then raise exception 'Assignment not found' using errcode = 'P0002'; end if;
  mine := exists (select 1 from public.students s where s.id = x.student_id and s.user_id = auth.uid());
  if public.is_staff(x.org_id) then
    update public.assignments set status = p_status, feedback = coalesce(p_feedback, feedback), completed_at = case when p_status in ('completed', 'reviewed') then coalesce(completed_at, now()) end where id = p_id;
  elsif mine and p_status in ('started', 'completed') and x.status in ('assigned', 'started') then
    update public.assignments set status = p_status, completed_at = case when p_status = 'completed' then now() end where id = p_id;
  else raise exception 'Not allowed' using errcode = '42501';
  end if;
end $$;

-- Link a parent account to a child (teacher-issued, V2 portal uses it)
create or replace function public.link_guardian(p_student uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare org uuid;
begin
  select org_id into org from public.students where id = p_student;
  if org is null or not public.is_staff(org) then raise exception 'Not allowed' using errcode = '42501'; end if;
  insert into public.organization_members (org_id, user_id, role) values (org, p_user, 'parent') on conflict do nothing;
  insert into public.student_guardians (student_id, user_id, org_id) values (p_student, p_user, org) on conflict do nothing;
end $$;

-- Functions are callable only by signed-in users (Supabase grants new functions to everyone by default).
do $$ declare f text; begin
  foreach f in array array[
    'public.org_settings(uuid)', 'public.org_today(uuid)', 'public.create_organization(text, text, text)', 'public.join_organization(text, text)',
    'public.regenerate_codes(uuid)', 'public.memorised_pages(uuid)', 'public.sync_revision_items(uuid, uuid, date, boolean)',
    'public.insert_ranges(uuid, uuid, jsonb, date, text, uuid)', 'public.refresh_milestones(uuid, date)', 'public.create_student(jsonb)',
    'public.record_session(jsonb)', 'public.delete_session(uuid)', 'public.set_assignment_status(uuid, public.assignment_status, text)',
    'public.link_guardian(uuid, uuid)', 'public.audit_row()', 'public.students_guard()'] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
  foreach f in array array[
    'public.org_settings(uuid)', 'public.org_today(uuid)', 'public.create_organization(text, text, text)', 'public.join_organization(text, text)',
    'public.regenerate_codes(uuid)', 'public.create_student(jsonb)', 'public.record_session(jsonb)', 'public.delete_session(uuid)',
    'public.set_assignment_status(uuid, public.assignment_status, text)', 'public.link_guardian(uuid, uuid)'] loop
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
-- internal helpers (memorised_pages, sync_revision_items, insert_ranges, refresh_milestones) stay private: they are only called inside the functions above.

-- Live updates for the teacher dashboard (Supabase Realtime), when the publication exists.
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table public.sessions; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.assignments; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.students; exception when duplicate_object then null; end;
  end if;
end $$;
