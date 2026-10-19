-- Hifz Tracker: run once in Supabase → SQL Editor → New query → paste → Run.
-- Lets teachers/students un-mark surahs, and lets a teacher take back a sign-off (removes the lesson from "memorised").
-- Safe to run more than once.

create or replace function public.set_memorised_surahs(p_student uuid, p jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare s public.students; today date; sur int[]; skip smallint[]; nf int; part jsonb;
begin
  select * into s from public.students where id = p_student and archived_at is null;
  if not found or not (public.is_staff(s.org_id) or s.user_id = auth.uid()) then raise exception 'Not allowed' using errcode = '42501'; end if;
  today := (public.org_local_now(s.org_id))::date;
  if p ? 'surahs' then
    sur := array(select distinct x::int from jsonb_array_elements_text(p->'surahs') x where x::int between 1 and 114 order by 1);
    delete from public.memorized_ranges where student_id = s.id and source = 'setup';
    insert into public.memorized_ranges (org_id, student_id, start_ayah_id, end_ayah_id, memorized_on, source)
    select s.org_id, s.id, min(a.id), max(a.id), today, 'setup' from public.quran_ayahs a where a.surah = any (sur) group by a.surah;
    -- part of a surah, e.g. {"surah": 67, "ayahs": 12}
    part := p->'partial';
    if part is not null and (part->>'surah')::int between 1 and 114 and coalesce((part->>'ayahs')::int, 0) > 0 then
      insert into public.memorized_ranges (org_id, student_id, start_ayah_id, end_ayah_id, memorized_on, source)
      select s.org_id, s.id, min(a.id), max(a.id), today, 'setup' from public.quran_ayahs a where a.surah = (part->>'surah')::int and a.ayah <= (part->>'ayahs')::int;
    end if;
    -- revision items: add newly memorised pages, drop pages no longer memorised
    perform public.sync_revision_items(s.id, s.org_id, today, true);
    delete from public.revision_items ri where ri.student_id = s.id and ri.page not in (select page from public.memorised_pages(s.id));
    perform public.refresh_milestones(s.id, today);
  end if;
  if p ? 'skipped' then
    skip := array(select distinct x::smallint from jsonb_array_elements_text(p->'skipped') x where x::int between 1 and 114 order by 1);
    update public.students set skipped_surahs = skip where id = s.id;
  end if;
  if p ? 'next_from' then
    nf := nullif(p->>'next_from', '')::int;
    if nf is not null and (nf < 1 or nf > 114) then nf := null; end if;
    update public.students set next_from_surah = nf where id = s.id;
  end if;
  if p ? 'direction' and p->>'direction' in ('back', 'forward') then update public.students set direction = p->>'direction' where id = s.id; end if;
end $$;

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
