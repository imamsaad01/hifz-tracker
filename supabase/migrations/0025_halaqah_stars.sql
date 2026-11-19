-- The class goal: each halaqah's heard stars this month, added up. Any member of the program can see the total
-- (it is one number per halaqah, no names). Same rules as src/lib/stars.ts: a part counts once per student per day,
-- 1 star when a partner confirmed it or a teacher heard it, 2 when a teacher heard it with no mistakes, 0 if "redo".
create or replace function public.halaqah_stars(p_class uuid)
returns table (stars int, students int)
language plpgsql stable security definer set search_path = public as $$
declare c public.classes; start_on date; today date;
begin
  select * into c from public.classes where id = p_class and archived_at is null;
  if not found or not public.is_member(c.org_id) then raise exception 'Not allowed' using errcode = '42501'; end if;
  today := public.org_local_now(c.org_id)::date; start_on := date_trunc('month', today)::date;
  return query
  with kids as (select cs.student_id from public.class_students cs join public.students s on s.id = cs.student_id where cs.class_id = p_class and s.archived_at is null),
  graded as (
    select x.student_id, x.date, case when x.type = 'juz_revision' then 'old' else x.type::text end as part,
      case
        when x.check_status = 'redo' then 0
        when not coalesce(x.self_logged, false) and x.recorded_by::text = 'teacher' then case when x.errors_major + x.errors_minor = 0 then 2 else 1 end
        when x.partner_status = 'confirmed' then 1
        when x.check_status = 'ok' then case when x.errors_major + x.errors_minor = 0 then 2 else 1 end
        else 0 end as v
    from public.sessions x
    where x.deleted_at is null and x.org_id = c.org_id and x.student_id in (select student_id from kids)
      and x.date between start_on and today and x.type in ('new', 'recent', 'old', 'juz_revision')
  ), best as (select g.student_id, g.date, g.part, max(g.v) as v from graded g group by 1, 2, 3)
  select coalesce(sum(b.v), 0)::int, (select count(*)::int from kids) from best b;
end $$;
revoke all on function public.halaqah_stars(uuid) from public, anon;
grant execute on function public.halaqah_stars(uuid) to authenticated;
