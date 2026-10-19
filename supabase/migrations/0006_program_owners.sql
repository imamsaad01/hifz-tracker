-- 0006 · Only platform owners may start new programs. Everyone else joins with a code.
-- Add an owner (SQL Editor):  insert into public.platform_owners (user_id) select id from auth.users where email = 'you@example.com';
create table if not exists public.platform_owners (
  user_id uuid primary key references auth.users (id) on delete cascade,
  added_at timestamptz not null default now()
);
alter table public.platform_owners enable row level security;   -- no policies: not readable or writable from the app
revoke all on public.platform_owners from anon, authenticated;

create or replace function public.can_create_programs() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.platform_owners where user_id = auth.uid());
$$;
revoke all on function public.can_create_programs() from public, anon;
grant execute on function public.can_create_programs() to authenticated;

create or replace function public.create_organization(p_name text, p_timezone text default 'America/New_York', p_display_name text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare oid uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  if not public.can_create_programs() then raise exception 'Only the site owner can start a new program. Ask your teacher for a join code.' using errcode = '42501'; end if;
  if p_name is null or char_length(trim(p_name)) < 2 then raise exception 'Give the program a name' using errcode = '22023'; end if;
  if not exists (select 1 from pg_timezone_names where name = p_timezone) then raise exception 'Unknown time zone %', p_timezone using errcode = '22023'; end if;
  insert into public.organizations (name, timezone) values (trim(p_name), p_timezone) returning id into oid;
  insert into public.organization_members (org_id, user_id, role, display_name) values (oid, auth.uid(), 'admin', nullif(trim(p_display_name), ''));
  insert into public.subscriptions (org_id) values (oid);
  return oid;
end $$;
revoke all on function public.create_organization(text, text, text) from public, anon;
grant execute on function public.create_organization(text, text, text) to authenticated;
