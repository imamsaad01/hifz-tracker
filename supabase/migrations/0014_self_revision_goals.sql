-- Students log their own revision and the teacher checks it; students choose where their Old revision cycle starts;
-- qira'at students set how much they read each class.

-- 1. where the Old-revision cycle starts (pages not revised since this date go in page order from here)
alter table public.students add column if not exists revision_start_page int check (revision_start_page between 1 and 604);
alter table public.students add column if not exists revision_start_on date;

create or replace function public.set_revision_start(p_student uuid, p_page int) returns void
language plpgsql security definer set search_path = public as $$
declare s public.students;
begin
  select * into s from public.students where id = p_student and archived_at is null;
  if not found or not (public.is_staff(s.org_id) or s.user_id = auth.uid()) then raise exception 'Not allowed' using errcode = '42501'; end if;
  if p_page is not null and (p_page < 1 or p_page > 604) then raise exception 'Choose a page from 1 to 604' using errcode = '22023'; end if;
  update public.students set revision_start_page = p_page, revision_start_on = case when p_page is null then null else (public.org_local_now(s.org_id))::date end
  where id = s.id;
end $$;

-- new lesson size in pages (½, 1–5); when set it is used instead of daily_new_ayahs
alter table public.students add column if not exists new_pages numeric(3,1) check (new_pages in (0.5, 1, 2, 3, 4, 5));

-- 2. teacher checks revision the student logged
alter table public.sessions add column if not exists check_status text check (check_status in ('ok', 'redo'));
alter table public.sessions add column if not exists checked_at timestamptz;
alter table public.sessions add column if not exists checked_by uuid;
alter table public.sessions add column if not exists check_note text check (check_note is null or char_length(check_note) <= 500);

create or replace function public.check_sessions(p_ids uuid[], p_status text, p_note text default null) returns int
language plpgsql security definer set search_path = public as $$
declare n int; r record;
begin
  if p_status not in ('ok', 'redo') then raise exception 'Unknown status' using errcode = '22023'; end if;
  update public.sessions s set check_status = p_status, checked_at = now(), checked_by = auth.uid(), check_note = nullif(trim(p_note), '')
  where s.id = any (p_ids) and s.deleted_at is null and public.is_staff(s.org_id);
  get diagnostics n = row_count;
  if n = 0 and coalesce(array_length(p_ids, 1), 0) > 0 then raise exception 'Teachers only' using errcode = '42501'; end if;
  if p_status = 'redo' then
    for r in select s.student_id, s.type, s.date from public.sessions s where s.id = any (p_ids) and s.check_status = 'redo' loop
      perform public.enqueue(u.user_id, 'Please redo your ' || initcap(r.type::text) || ' revision', coalesce(nullif(trim(p_note), ''), 'Your teacher asked you to revise it again.') || ' (' || to_char(r.date, 'Dy DD Mon') || ')', '#/home')
      from public.student_audience(r.student_id) u where u.user_id is distinct from auth.uid();
    end loop;
  end if;
  return n;
end $$;

-- 3. qira'at: how much the student aims to read each class
alter table public.qiraat_profiles add column if not exists class_goal text check (class_goal in ('half_page', 'page', '2_pages', 'quarter_hizb', 'half_hizb', 'hizb', 'juz'));

create or replace function public.set_qiraat_profile(p_student uuid, p jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare s public.students; r text[]; m text; mt text; lines int; act boolean; g text;
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
  g := nullif(p->>'class_goal', '');
  if g is not null and g not in ('half_page', 'page', '2_pages', 'quarter_hizb', 'half_hizb', 'hizb', 'juz') then g := null; end if;
  insert into public.qiraat_profiles (student_id, org_id, active, riwayat, mode, matn, matn_daily_lines, class_goal, updated_at)
  values (s.id, s.org_id, act, r, m, mt, lines, g, now())
  on conflict (student_id) do update set active = excluded.active, riwayat = excluded.riwayat, mode = excluded.mode, matn = excluded.matn,
    matn_daily_lines = excluded.matn_daily_lines, class_goal = excluded.class_goal, updated_at = now();
end $$;

revoke all on function public.set_revision_start(uuid, int) from public, anon;
grant execute on function public.set_revision_start(uuid, int) to authenticated;
revoke all on function public.check_sessions(uuid[], text, text) from public, anon;
grant execute on function public.check_sessions(uuid[], text, text) to authenticated;
