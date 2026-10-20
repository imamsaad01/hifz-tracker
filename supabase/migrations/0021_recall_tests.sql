-- "Test yourself" results: a student recites a passage from memory, peeking only when stuck.
-- The teacher sees the latest result on the Live class card.
create table if not exists public.recall_tests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  start_ayah_id smallint not null check (start_ayah_id between 1 and 6236),
  end_ayah_id smallint not null check (end_ayah_id between 1 and 6236 and end_ayah_id >= start_ayah_id),
  total int not null check (total between 1 and 300),
  peeked smallint[] not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists recall_tests_student on public.recall_tests (student_id, created_at desc);
alter table public.recall_tests enable row level security;
revoke all on public.recall_tests from anon;
grant select on public.recall_tests to authenticated;
create policy recall_tests_read on public.recall_tests for select to authenticated using (public.is_staff(org_id) or public.can_see_student(student_id));

-- Only the student themself saves a result.
create or replace function public.save_recall_test(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare st public.students; a smallint := (p->>'start_ayah_id')::smallint; b smallint := (p->>'end_ayah_id')::smallint;
  pk smallint[] := coalesce((select array_agg(distinct x::smallint) from jsonb_array_elements_text(coalesce(p->'peeked', '[]'::jsonb)) x), '{}'); n int := (p->>'total')::int; rid uuid;
begin
  select * into st from public.students where id = (p->>'student_id')::uuid and archived_at is null;
  if not found or st.user_id is distinct from auth.uid() then raise exception 'Only the student can save their test' using errcode = '42501'; end if;
  if a is null or b is null or a < 1 or b > 6236 or a > b then raise exception 'Invalid Qur''an range' using errcode = '22023'; end if;
  if n is null or n < 1 or n > 300 or cardinality(pk) > n then raise exception 'Invalid result' using errcode = '22023'; end if;
  if exists (select 1 from unnest(pk) x where x < a or x > b) then raise exception 'Peeked ayahs must be inside the range' using errcode = '22023'; end if;
  insert into public.recall_tests (org_id, student_id, start_ayah_id, end_ayah_id, total, peeked) values (st.org_id, st.id, a, b, n, pk) returning id into rid;
  return rid;
end $$;
revoke all on function public.save_recall_test(jsonb) from public, anon;
grant execute on function public.save_recall_test(jsonb) to authenticated;
