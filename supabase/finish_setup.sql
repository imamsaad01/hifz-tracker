-- Finish setup: paste ALL of this into Supabase → SQL Editor → New query → Run.
-- Adds the two functions the app uses to save and delete sessions, and stops signed-out visitors calling any function.
-- Safe to run more than once. It changes no data.

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


revoke all on function public.record_session(jsonb), public.delete_session(uuid) from public, anon;
grant execute on function public.record_session(jsonb), public.delete_session(uuid) to authenticated;

do $$ declare f record; begin
  for f in select p.oid::regprocedure as sig from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prokind = 'f' loop
    execute format('revoke execute on function %s from anon, public', f.sig);
  end loop;
end $$;

do $$ begin
  begin alter publication supabase_realtime add table public.milestones; exception when duplicate_object or undefined_object then null; end;
end $$;

select 'Done: record_session and delete_session are installed' as result;
