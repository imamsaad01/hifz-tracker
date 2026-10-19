-- Students who memorised out of order: which surahs they skipped, and where the next lesson starts.
alter table public.students add column if not exists next_from_surah smallint check (next_from_surah between 1 and 114);
alter table public.students add column if not exists skipped_surahs smallint[] not null default '{}';

-- Replace the set-up record of memorised surahs (lessons recorded in sessions are kept), set the start point and skipped surahs.
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
revoke all on function public.set_memorised_surahs(uuid, jsonb) from public, anon;
grant execute on function public.set_memorised_surahs(uuid, jsonb) to authenticated;
