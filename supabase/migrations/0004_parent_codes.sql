-- 0004 · Parent codes. Each student has a 10-character code; a parent who signs in and enters it
-- becomes a read-only "parent" member linked to that one child. Students and staff can see it; only staff can change it.
alter table public.students add column if not exists parent_code text;
update public.students set parent_code = upper(substr(md5(random()::text || id::text), 1, 10)) where parent_code is null;
alter table public.students alter column parent_code set default upper(substr(md5(random()::text), 1, 10));
alter table public.students alter column parent_code set not null;
create unique index if not exists students_parent_code on public.students (parent_code);

create or replace function public.students_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff(old.org_id) then
    if new.org_id is distinct from old.org_id or new.user_id is distinct from old.user_id or new.parent_code is distinct from old.parent_code
       or new.archived_at is distinct from old.archived_at or new.start_date is distinct from old.start_date then
      raise exception 'Only a teacher can change this' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

create or replace function public.join_organization(p_code text, p_display_name text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare o public.organizations; r public.member_role; existing public.member_role; c text := upper(trim(p_code)); kid public.students;
begin
  if auth.uid() is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  if char_length(c) = 10 then                                   -- parent code
    select * into kid from public.students where parent_code = c and archived_at is null;
    if not found then raise exception 'That code was not found. Check it with your teacher.' using errcode = 'P0002'; end if;
    select role into existing from public.organization_members where org_id = kid.org_id and user_id = auth.uid();
    if not found then
      insert into public.organization_members (org_id, user_id, role, display_name) values (kid.org_id, auth.uid(), 'parent', nullif(trim(p_display_name), ''));
      existing := 'parent';
    end if;
    insert into public.student_guardians (student_id, user_id, org_id) values (kid.id, auth.uid(), kid.org_id) on conflict do nothing;
    return jsonb_build_object('org_id', kid.org_id, 'role', existing);
  end if;
  select * into o from public.organizations where deleted_at is null and (join_code = c or teacher_code = c);
  if not found then raise exception 'That code was not found. Check it with your teacher.' using errcode = 'P0002'; end if;
  r := case when o.teacher_code = c then 'teacher'::public.member_role else 'student'::public.member_role end;
  select role into existing from public.organization_members where org_id = o.id and user_id = auth.uid();
  if found then return jsonb_build_object('org_id', o.id, 'role', existing); end if;
  insert into public.organization_members (org_id, user_id, role, display_name) values (o.id, auth.uid(), r, nullif(trim(p_display_name), ''));
  return jsonb_build_object('org_id', o.id, 'role', r);
end $$;
revoke all on function public.join_organization(text, text) from public, anon;
grant execute on function public.join_organization(text, text) to authenticated;

-- the notify Edge Function runs as service_role and needs "today" in each program's time zone
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.org_today(uuid) to service_role;
  end if;
end $$;
