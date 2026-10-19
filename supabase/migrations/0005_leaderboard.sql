-- 0005 · Class leaderboard: rewards consistency (days present, pages revised, clean pages), never speed of new memorisation.
-- Points per student over the window: 10 per day with a session + 2 per revised page + 1 per page revised with no mistakes,
-- with revision counted at most 20 pages a day so one long day cannot outweigh daily effort.
-- Staff always see it with full names. Students and parents see it only when the admin turns it on, as "First L." by default.
create or replace function public.class_leaderboard(org uuid, p_days int default 7)
returns table (student_id uuid, display_name text, days_active int, pages_revised int, clean_pages int, points int, is_me boolean)
language plpgsql stable security definer set search_path = public as $$
declare lb jsonb; staff boolean; today date;
begin
  if not public.is_member(org) then raise exception 'Not a member of this program' using errcode = '42501'; end if;
  staff := public.is_staff(org);
  lb := '{"enabled":false,"fullNames":false}'::jsonb || coalesce((select settings->'leaderboard' from public.organizations where id = org), '{}');
  if not staff and not (lb->>'enabled')::boolean then raise exception 'The leaderboard is turned off' using errcode = '42501'; end if;
  today := public.org_today(org);
  p_days := least(greatest(coalesce(p_days, 7), 1), 90);
  return query
  with sess as (
    select s.student_id, s.date, s.type,
      (select count(distinct a.page)::int from public.quran_ayahs a where a.id between s.start_ayah_id and s.end_ayah_id) as pages,
      (s.errors_major + s.errors_minor) = 0 as clean
    from public.sessions s
    where s.org_id = org and s.deleted_at is null and s.date between today - (p_days - 1) and today
  ), per_day as (
    select x.student_id, x.date,
      least(coalesce(sum(x.pages) filter (where x.type <> 'new'), 0), 20)::int as rev,
      least(coalesce(sum(x.pages) filter (where x.type <> 'new' and x.clean), 0), 20)::int as cln
    from sess x group by x.student_id, x.date
  ), tot as (
    select d.student_id, count(*)::int as days, sum(d.rev)::int as rev, sum(d.cln)::int as cln from per_day d group by d.student_id
  )
  select st.id,
    case when staff or (lb->>'fullNames')::boolean or st.user_id = auth.uid() then st.name
         else split_part(st.name, ' ', 1) || coalesce(' ' || nullif(left(split_part(st.name, ' ', 2), 1), '') || '.', '') end,
    coalesce(t.days, 0), coalesce(t.rev, 0), coalesce(t.cln, 0),
    (coalesce(t.days, 0) * 10 + coalesce(t.rev, 0) * 2 + coalesce(t.cln, 0))::int,
    (st.user_id = auth.uid() or exists (select 1 from public.student_guardians g where g.student_id = st.id and g.user_id = auth.uid()))
  from public.students st left join tot t on t.student_id = st.id
  where st.org_id = org and st.archived_at is null
  order by 6 desc, 3 desc, 2;
end $$;
revoke all on function public.class_leaderboard(uuid, int) from public, anon;
grant execute on function public.class_leaderboard(uuid, int) to authenticated;
