-- Nudges students to log their revision: on revision days in the evening if nothing is logged yet,
-- and on Sunday evening with the week's total.
create or replace function public.revision_log_reminders() returns int
language plpgsql security definer set search_path = public as $$
declare o record; local timestamp; t time; k text; n int := 0; ws date; on_ boolean;
begin
  for o in select * from public.organizations where deleted_at is null loop
    local := public.org_local_now(o.id);
    on_ := coalesce((o.settings->'revision'->>'logRemind')::boolean, true);
    if not on_ then continue; end if;
    t := coalesce(nullif(o.settings->'revision'->>'logReminderTime', ''), '20:30')::time;
    -- revision day, evening: nothing logged today
    if extract(dow from local)::int in (select x::int from jsonb_array_elements_text(coalesce(o.settings->'revision'->'days', '[0,1,2,3,4,5,6]'::jsonb)) x)
       and local::time between t and t + interval '15 minutes' then
      k := 'log:' || o.id || ':' || local::date;
      if not exists (select 1 from public.reminders_sent where key = k) then
        insert into public.reminders_sent (key) values (k);
        perform public.enqueue(s.user_id, 'Did you do today’s revision?', 'Log your Old revision in Hifz so your teacher can sign it off.', '#/home')
        from public.students s where s.org_id = o.id and s.archived_at is null and s.user_id is not null
          and not exists (select 1 from public.sessions x where x.student_id = s.id and x.date = local::date and x.type in ('old', 'juz_revision') and x.deleted_at is null);
        n := n + 1;
      end if;
    end if;
    -- Sunday 7 pm: the week's total
    if extract(isodow from local) = 7 and local::time between '19:00' and '19:15' then
      ws := public.week_start(local::date);
      k := 'weeklog:' || o.id || ':' || ws;
      if not exists (select 1 from public.reminders_sent where key = k) then
        insert into public.reminders_sent (key) values (k);
        perform public.enqueue(s.user_id, 'Your revision this week',
          'You logged ' || coalesce((select count(distinct q.page) from public.sessions x join public.quran_ayahs q on q.id between x.start_ayah_id and x.end_ayah_id
            where x.student_id = s.id and x.date between ws and local::date and x.type in ('old', 'juz_revision') and x.deleted_at is null and x.check_status is distinct from 'redo'), 0)
          || ' Old revision pages. Log anything missing before Monday.', '#/home')
        from public.students s where s.org_id = o.id and s.archived_at is null and s.user_id is not null;
        n := n + 1;
      end if;
    end if;
  end loop;
  return n;
end $$;
revoke all on function public.revision_log_reminders() from public, anon, authenticated;
