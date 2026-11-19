-- Students get 3 phone notifications a week, nothing else: Monday, Wednesday and Friday at 7 pm (program time).
-- Teachers and admins keep all of theirs. Nothing is deleted: to undo, run
--   drop trigger if exists student_quiet on public.notification_queue;  select cron.unschedule('hifz-student-nudges');

-- 1. Quiet gate: a queued notification for someone who is only a student (or parent) is dropped,
--    unless it is one of the weekly nudges below (they set hifz.nudge = 'on' for their own transaction).
create or replace function public.student_quiet_gate() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('hifz.nudge', true), '') = 'on' then return new; end if;
  if exists (select 1 from public.organization_members m where m.user_id = new.user_id
             and (m.role in ('admin', 'teacher') or m.extra_roles && array['admin', 'teacher']::public.member_role[])) then
    return new;
  end if;
  return null;  -- student or parent only: stay quiet
end $$;
drop trigger if exists student_quiet on public.notification_queue;
create trigger student_quiet before insert on public.notification_queue for each row execute function public.student_quiet_gate();

-- 2. The three weekly nudges. Runs hourly; sends once per student per day, at 19:00 in the program's time zone.
create or replace function public.student_nudges() returns integer
language plpgsql security definer set search_path = public as $$
declare r record; n integer := 0; local timestamp; t text; b text;
begin
  perform set_config('hifz.nudge', 'on', true);
  for r in
    select s.id, s.user_id, s.org_id, split_part(s.name, ' ', 1) as first
    from public.students s join public.organizations o on o.id = s.org_id
    where s.archived_at is null and s.user_id is not null and o.deleted_at is null
  loop
    local := public.org_local_now(r.org_id);
    if extract(hour from local) <> 19 or extract(isodow from local) not in (1, 3, 5) then continue; end if;
    if exists (select 1 from public.reminders_sent where key = 'nudge:' || r.id || ':' || local::date) then continue; end if;
    case extract(isodow from local)::int
      when 1 then t := 'New week, new stars ⭐'; b := 'Salaam ' || r.first || '! Your 3 buttons are ready. Tap to start.';
      when 3 then t := 'Partner night 👂';      b := 'Read your Old pages to a friend tonight for a bonus star.';
      else        t := 'Keep your 🔥 going';     b := 'Partner night again. A few taps and you are done for the week.';
    end case;
    perform public.enqueue(r.user_id, t, b, '#/home');
    insert into public.reminders_sent (key) values ('nudge:' || r.id || ':' || local::date) on conflict do nothing;
    n := n + 1;
  end loop;
  perform set_config('hifz.nudge', '', true);
  return n;
end $$;
revoke all on function public.student_nudges() from public, anon, authenticated;
revoke all on function public.student_quiet_gate() from public, anon, authenticated;

-- 3. Schedule it (pg_cron). Hourly at :00; the function itself picks 7 pm local.
select cron.unschedule('hifz-student-nudges') where exists (select 1 from cron.job where jobname = 'hifz-student-nudges');
select cron.schedule('hifz-student-nudges', '0 * * * *', $$select public.student_nudges();$$);
