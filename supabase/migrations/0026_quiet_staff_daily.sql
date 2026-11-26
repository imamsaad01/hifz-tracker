-- Staff were getting ~4 notifications a day: one per student for revision follow-ups and attendance warnings.
-- Those now show on the teacher's Today screen instead. Staff keep the things that need them: lesson sign-offs,
-- join and absence requests, messages, and the weekly "Last week in …" summary.
-- To undo: re-run 0024's student_quiet_gate.
create or replace function public.student_quiet_gate() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('hifz.nudge', true), '') = 'on' then return new; end if;
  -- the daily per-student reminders: nobody gets these any more
  if new.title in ('Revision follow-up', 'Attendance warning', 'Did you do today’s revision?', 'Revision today',
                   'Old revision this week', 'Partner revision tonight', 'Missed revision sessions',
                   'Weekly revision form', 'Your revision this week') then
    return null;
  end if;
  if exists (select 1 from public.organization_members m where m.user_id = new.user_id
             and (m.role in ('admin', 'teacher') or m.extra_roles && array['admin', 'teacher']::public.member_role[])) then
    return new;
  end if;
  return null;  -- student or parent only: stay quiet
end $$;
