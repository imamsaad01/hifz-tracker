-- 0002 · Row-level security. The database, not the page, decides who sees what.
-- Roles per organization: admin, teacher (= "staff"), student, parent.
-- Writes to hifz records (sessions, errors, memorised ranges, revision state, milestones) go only
-- through the server functions in 0003, so every multi-step change is validated and atomic.

create or replace function public.has_role(org uuid, roles public.member_role[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.organization_members m where m.org_id = org and m.user_id = auth.uid() and m.role = any (roles));
$$;
create or replace function public.is_member(org uuid) returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(org, array['admin', 'teacher', 'student', 'parent']::public.member_role[]);
$$;
create or replace function public.is_staff(org uuid) returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(org, array['admin', 'teacher']::public.member_role[]);
$$;
create or replace function public.is_admin(org uuid) returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(org, array['admin']::public.member_role[]);
$$;
-- staff of the student's organization, the student themself, or a linked guardian
create or replace function public.can_see_student(sid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.students s
    where s.id = sid and (public.is_staff(s.org_id) or s.user_id = auth.uid()
      or exists (select 1 from public.student_guardians g where g.student_id = s.id and g.user_id = auth.uid())));
$$;

revoke all on all tables in schema public from anon;
grant select on public.quran_surahs, public.quran_ayahs to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on function public.has_role(uuid, public.member_role[]), public.is_member(uuid), public.is_staff(uuid), public.is_admin(uuid), public.can_see_student(uuid) to authenticated;

alter table public.quran_surahs enable row level security;
alter table public.quran_ayahs enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.students enable row level security;
alter table public.student_guardians enable row level security;
alter table public.classes enable row level security;
alter table public.class_students enable row level security;
alter table public.sessions enable row level security;
alter table public.session_errors enable row level security;
alter table public.memorized_ranges enable row level security;
alter table public.revision_items enable row level security;
alter table public.attendance enable row level security;
alter table public.assignments enable row level security;
alter table public.goals enable row level security;
alter table public.milestones enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;
alter table public.subscriptions enable row level security;

-- Qur'an reference: readable by everyone, writable by no one through the API
create policy quran_surahs_read on public.quran_surahs for select to anon, authenticated using (true);
create policy quran_ayahs_read on public.quran_ayahs for select to anon, authenticated using (true);

create policy orgs_read on public.organizations for select to authenticated using (public.is_member(id));
create policy orgs_admin_update on public.organizations for update to authenticated using (public.is_admin(id)) with check (public.is_admin(id));

create policy members_read on public.organization_members for select to authenticated using (public.is_member(org_id));
create policy members_admin_update on public.organization_members for update to authenticated using (public.is_admin(org_id)) with check (public.is_admin(org_id));
create policy members_admin_delete on public.organization_members for delete to authenticated using (public.is_admin(org_id) and user_id <> auth.uid());

create policy students_read on public.students for select to authenticated using (public.can_see_student(id));
create policy students_staff_insert on public.students for insert to authenticated with check (public.is_staff(org_id));
create policy students_update on public.students for update to authenticated
  using (public.is_staff(org_id) or user_id = auth.uid()) with check (public.is_staff(org_id) or user_id = auth.uid());

create policy guardians_read on public.student_guardians for select to authenticated using (public.is_staff(org_id) or user_id = auth.uid());
create policy guardians_staff_write on public.student_guardians for all to authenticated using (public.is_staff(org_id)) with check (public.is_staff(org_id));

create policy classes_read on public.classes for select to authenticated using (public.is_member(org_id));
create policy classes_staff_write on public.classes for all to authenticated using (public.is_staff(org_id)) with check (public.is_staff(org_id));
create policy class_students_read on public.class_students for select to authenticated using (public.is_staff(org_id) or public.can_see_student(student_id));
create policy class_students_staff_write on public.class_students for all to authenticated using (public.is_staff(org_id)) with check (public.is_staff(org_id));

-- hifz records: read by those who can see the student; written only by 0003 functions
create policy sessions_read on public.sessions for select to authenticated using (public.can_see_student(student_id));
create policy session_errors_read on public.session_errors for select to authenticated
  using (exists (select 1 from public.sessions s where s.id = session_id and public.can_see_student(s.student_id)));
create policy memorized_read on public.memorized_ranges for select to authenticated using (public.can_see_student(student_id));
create policy revision_read on public.revision_items for select to authenticated using (public.can_see_student(student_id));
create policy milestones_read on public.milestones for select to authenticated using (public.can_see_student(student_id));

create policy attendance_read on public.attendance for select to authenticated using (public.can_see_student(student_id));
create policy attendance_staff_write on public.attendance for all to authenticated using (public.is_staff(org_id)) with check (public.is_staff(org_id));

create policy assignments_read on public.assignments for select to authenticated using (public.can_see_student(student_id));
create policy assignments_staff_write on public.assignments for all to authenticated using (public.is_staff(org_id)) with check (public.is_staff(org_id));

create policy goals_read on public.goals for select to authenticated using (public.can_see_student(student_id));
create policy goals_staff_write on public.goals for all to authenticated using (public.is_staff(org_id)) with check (public.is_staff(org_id));

create policy notifications_staff_read on public.notifications for select to authenticated using (public.is_staff(org_id));
create policy audit_admin_read on public.audit_logs for select to authenticated using (public.is_admin(org_id));
create policy subscriptions_admin_read on public.subscriptions for select to authenticated using (public.is_admin(org_id));

-- A student may edit their own plan (daily amount, goal, parent contact) but not who they are or where they belong.
create or replace function public.students_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff(old.org_id) then
    if new.org_id is distinct from old.org_id or new.user_id is distinct from old.user_id
       or new.archived_at is distinct from old.archived_at or new.start_date is distinct from old.start_date then
      raise exception 'Only a teacher can change this' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists students_guard on public.students;
create trigger students_guard before update on public.students for each row execute function public.students_guard();

-- Organization settings are edited by admins only (covered by orgs_admin_update); codes are regenerated by function.

-- The teacher code turns whoever uses it into a teacher, so only admins may read it (via teacher_code()).
revoke select, update on public.organizations from authenticated;
grant select (id, name, timezone, join_code, settings, created_at, deleted_at) on public.organizations to authenticated;
grant update (name, timezone, settings) on public.organizations to authenticated;
create or replace function public.teacher_code(org uuid) returns text
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin(org) then raise exception 'Only an admin can see the teacher code' using errcode = '42501'; end if;
  return (select teacher_code from public.organizations where id = org);
end $$;
revoke all on function public.teacher_code(uuid) from public, anon;
grant execute on function public.teacher_code(uuid) to authenticated;
-- the same for the helper functions above: callable by signed-in users only
revoke all on function public.has_role(uuid, public.member_role[]), public.is_member(uuid), public.is_staff(uuid), public.is_admin(uuid), public.can_see_student(uuid) from public, anon;
grant execute on function public.has_role(uuid, public.member_role[]), public.is_member(uuid), public.is_staff(uuid), public.is_admin(uuid), public.can_see_student(uuid) to authenticated;
