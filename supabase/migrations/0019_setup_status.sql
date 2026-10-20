-- Teachers see who still needs setting up (notifications on, halaqah, rules, parent), and small hardening from the Supabase advisor.
create or replace function public.setup_status(org uuid) returns table (student_id uuid, notifications boolean, parents int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff(org) then raise exception 'Teachers only' using errcode = '42501'; end if;
  return query select s.id,
    exists (select 1 from public.push_subscriptions p where p.user_id = s.user_id),
    (select count(*)::int from public.student_guardians g where g.student_id = s.id)
  from public.students s where s.org_id = org and s.archived_at is null;
end $$;
revoke all on function public.setup_status(uuid) from public, anon;
grant execute on function public.setup_status(uuid) to authenticated;

alter function public.week_start(date) set search_path = public;
alter function public.mark_self_logged() set search_path = public;
alter function public.riwayah_codes() set search_path = public;
alter function public.matn_lines(text) set search_path = public;
alter function public.matn_name(text) set search_path = public;
