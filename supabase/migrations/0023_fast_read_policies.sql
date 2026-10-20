-- Speed: read policies used can_see_student(student_id), which runs a lookup for EVERY row (2,600+ for revision_items).
-- These two set-returning helpers run once per query (Postgres caches the sub-select), with exactly the same meaning:
-- staff see their program's rows; a student sees their own; a guardian sees their children's.
create or replace function public.my_staff_orgs() returns setof uuid language sql stable security definer set search_path = public as $$
  select o.id from public.organizations o where public.is_staff(o.id);
$$;
create or replace function public.my_visible_students() returns setof uuid language sql stable security definer set search_path = public as $$
  select s.id from public.students s where s.user_id = auth.uid()
  union select g.student_id from public.student_guardians g where g.user_id = auth.uid();
$$;
revoke all on function public.my_staff_orgs() from public, anon;
revoke all on function public.my_visible_students() from public, anon;
grant execute on function public.my_staff_orgs() to authenticated;
grant execute on function public.my_visible_students() to authenticated;
alter policy revision_read on public.revision_items using (org_id in (select public.my_staff_orgs()) or student_id in (select public.my_visible_students()));
alter policy memorized_read on public.memorized_ranges using (org_id in (select public.my_staff_orgs()) or student_id in (select public.my_visible_students()));
alter policy milestones_read on public.milestones using (org_id in (select public.my_staff_orgs()) or student_id in (select public.my_visible_students()));
alter policy attendance_read on public.attendance using (org_id in (select public.my_staff_orgs()) or student_id in (select public.my_visible_students()));
alter policy assignments_read on public.assignments using (org_id in (select public.my_staff_orgs()) or student_id in (select public.my_visible_students()));
alter policy goals_read on public.goals using (org_id in (select public.my_staff_orgs()) or student_id in (select public.my_visible_students()));
alter policy messages_read on public.messages using (org_id in (select public.my_staff_orgs()) or student_id in (select public.my_visible_students()));
alter policy behaviour_read on public.behaviour_points using (org_id in (select public.my_staff_orgs()) or student_id in (select public.my_visible_students()));
alter policy exams_read on public.exams using (org_id in (select public.my_staff_orgs()) or student_id in (select public.my_visible_students()));
alter policy absence_read on public.absence_requests using (org_id in (select public.my_staff_orgs()) or student_id in (select public.my_visible_students()));
alter policy revision_form_read on public.revision_checkins using (org_id in (select public.my_staff_orgs()) or student_id in (select public.my_visible_students()));
alter policy class_join_read on public.class_join_requests using (org_id in (select public.my_staff_orgs()) or student_id in (select public.my_visible_students()));
alter policy qiraat_profiles_read on public.qiraat_profiles using (org_id in (select public.my_staff_orgs()) or student_id in (select public.my_visible_students()));
alter policy qiraat_tests_read on public.qiraat_tests using (org_id in (select public.my_staff_orgs()) or student_id in (select public.my_visible_students()));
alter policy qiraat_khatmah_read on public.qiraat_khatmah using (org_id in (select public.my_staff_orgs()) or student_id in (select public.my_visible_students()));
alter policy qiraat_matn_read on public.qiraat_matn_log using (org_id in (select public.my_staff_orgs()) or student_id in (select public.my_visible_students()));
alter policy recall_tests_read on public.recall_tests using (org_id in (select public.my_staff_orgs()) or student_id in (select public.my_visible_students()));
alter policy class_students_read on public.class_students using (org_id in (select public.my_staff_orgs()) or student_id in (select public.my_visible_students()));
alter policy sessions_read on public.sessions using (org_id in (select public.my_staff_orgs()) or student_id in (select public.my_visible_students()));
alter policy students_read on public.students using (org_id in (select public.my_staff_orgs()) or id in (select public.my_visible_students()));
alter policy session_errors_read on public.session_errors using (org_id in (select public.my_staff_orgs()) or session_id in (select s.id from public.sessions s where s.student_id in (select public.my_visible_students())));
