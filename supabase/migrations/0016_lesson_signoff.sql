-- Students submit what they read (new lesson and revision); the teacher signs it off with mistakes and a note.
-- A student's new lesson only counts as memorised once signed off.
alter table public.sessions add column if not exists self_logged boolean not null default false;

create or replace function public.mark_self_logged() returns trigger language plpgsql as $$
begin
  if new.recorded_by = 'student' then new.self_logged := true; end if;
  return new;
end $$;
drop trigger if exists mark_self_logged on public.sessions;
create trigger mark_self_logged before insert on public.sessions for each row execute function public.mark_self_logged();
update public.sessions set self_logged = true where recorded_by = 'student' and not self_logged;

-- Student submits a new lesson they memorised (waits for the teacher's sign-off before it counts)
create or replace function public.submit_lesson(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare st public.students; a smallint := (p->>'start_ayah_id')::smallint; b smallint := (p->>'end_ayah_id')::smallint; d date; sid uuid;
begin
  select * into st from public.students where id = (p->>'student_id')::uuid and archived_at is null;
  if not found or st.user_id is distinct from auth.uid() then raise exception 'Only the student can submit their lesson' using errcode = '42501'; end if;
  if a is null or b is null or a < 1 or b > 6236 or a > b then raise exception 'Invalid Qur''an range' using errcode = '22023'; end if;
  d := public.org_today(st.org_id);
  if exists (select 1 from public.sessions where student_id = st.id and date = d and type = 'new' and start_ayah_id = a and recorded_by = 'teacher' and deleted_at is null) then
    raise exception 'Your teacher already recorded this lesson' using errcode = '42501'; end if;
  insert into public.sessions as s (org_id, student_id, date, type, start_ayah_id, end_ayah_id, student_note, recorded_by, recorded_by_user, self_logged)
  values (st.org_id, st.id, d, 'new', a, b, nullif(trim(p->>'student_note'), ''), 'student', auth.uid(), true)
  on conflict (student_id, date, type, start_ayah_id) do update set end_ayah_id = excluded.end_ayah_id, student_note = excluded.student_note,
    check_status = null, checked_at = null, checked_by = null, check_note = null, deleted_at = null, updated_at = now()
  returning id into sid;
  perform public.enqueue(u.user_id, 'Lesson to sign off: ' || st.name, 'New: ' || coalesce(public.range_text(a, b), ''), '#/today')
  from public.staff_of(st.org_id) u;
  return sid;
end $$;

-- Teacher signs off one submitted session: confirm (with mistakes and a note) or send back to redo.
create or replace function public.sign_off_session(p_id uuid, p jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare s public.sessions; st text := p->>'status'; maj int; mnr int; note text; cfg jsonb; n_pages int; per int; fail int; weak int;
begin
  select * into s from public.sessions where id = p_id and deleted_at is null;
  if not found or not public.is_staff(s.org_id) then raise exception 'Teachers only' using errcode = '42501'; end if;
  if st not in ('ok', 'redo') then raise exception 'Unknown status' using errcode = '22023'; end if;
  maj := greatest(0, least(99, coalesce((p->>'errors_major')::int, s.errors_major)));
  mnr := greatest(0, least(99, coalesce((p->>'errors_minor')::int, s.errors_minor)));
  note := nullif(trim(p->>'note'), '');
  update public.sessions set errors_major = maj, errors_minor = mnr, teacher_note = coalesce(note, teacher_note),
    check_status = st, checked_at = now(), checked_by = auth.uid(), check_note = note, updated_at = now()
  where id = s.id;
  if s.type = 'new' then
    delete from public.memorized_ranges where session_id = s.id;
    if st = 'ok' then
      perform public.insert_ranges(s.student_id, s.org_id, jsonb_build_array(jsonb_build_array(s.start_ayah_id, s.end_ayah_id)), s.date, 'session', s.id);
      perform public.sync_revision_items(s.student_id, s.org_id, s.date, false);
    end if;
    perform public.refresh_milestones(s.student_id, s.date);
  elsif st = 'ok' and maj + mnr > 0 then
    -- mistakes found in revision make those pages weak / due again
    cfg := public.org_settings(s.org_id); weak := (cfg->'revision'->>'weakThreshold')::int; fail := (cfg->'revision'->>'failThreshold')::int;
    select count(distinct page) into n_pages from public.quran_ayahs where id between s.start_ayah_id and s.end_ayah_id;
    per := ceil((maj + mnr)::numeric / greatest(1, n_pages))::int;
    update public.revision_items ri set
      interval_days = case when per >= fail then 1 else ri.interval_days end,
      due_on = case when per >= fail then s.date + 1 else ri.due_on end,
      lapses = ri.lapses + case when per >= fail then 1 else 0 end
    where ri.student_id = s.student_id and ri.page in (select distinct page from public.quran_ayahs where id between s.start_ayah_id and s.end_ayah_id) and per >= weak;
  end if;
  perform public.enqueue(u.user_id,
    case when st = 'ok' then 'Signed off: ' || initcap(replace(s.type::text, '_', ' ')) else 'Please redo: ' || initcap(replace(s.type::text, '_', ' ')) end,
    coalesce(public.range_text(s.start_ayah_id, s.end_ayah_id), '') || case when maj + mnr > 0 then ' · ' || (maj + mnr) || ' mistake(s)' else '' end || coalesce(' · ' || note, ''), '#/home')
  from public.student_audience(s.student_id) u where u.user_id is distinct from auth.uid();
end $$;

-- "Check all" / quick check: sign off each one as it is
create or replace function public.check_sessions(p_ids uuid[], p_status text, p_note text default null) returns int
language plpgsql security definer set search_path = public as $$
declare i uuid; n int := 0;
begin
  foreach i in array coalesce(p_ids, '{}') loop
    perform public.sign_off_session(i, jsonb_build_object('status', p_status, 'note', p_note));
    n := n + 1;
  end loop;
  return n;
end $$;

revoke all on function public.mark_self_logged() from public, anon, authenticated;
revoke all on function public.submit_lesson(jsonb) from public, anon;
grant execute on function public.submit_lesson(jsonb) to authenticated;
revoke all on function public.sign_off_session(uuid, jsonb) from public, anon;
grant execute on function public.sign_off_session(uuid, jsonb) to authenticated;
