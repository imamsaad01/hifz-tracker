-- One-time setup for phone notifications (already applied to the live project).
-- Run in the Supabase SQL editor. Replace the <...> values; never commit real keys.
-- Generate VAPID keys with:  npx web-push generate-vapid-keys

create extension if not exists pg_cron;
create extension if not exists pg_net;

create table if not exists public.app_secrets (key text primary key, value text not null);
alter table public.app_secrets enable row level security;
revoke all on public.app_secrets from public, anon, authenticated;

create or replace function public.push_config() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) from public.app_secrets
$$;
revoke all on function public.push_config() from public, anon, authenticated;
grant execute on function public.push_config() to service_role;

insert into public.app_secrets (key, value) values
  ('vapid_public', '<VAPID public key — same as VITE_VAPID_PUBLIC_KEY>'),
  ('vapid_private', '<VAPID private key>'),
  ('vapid_subject', 'https://hifz-tracker-amber.vercel.app'),
  ('cron_secret', '<long random string>')
on conflict (key) do update set value = excluded.value;

-- Every 5 minutes: mark no-shows absent after class, and queue reminders.
select cron.schedule('hifz-reminders', '*/5 * * * *', 'select public.mark_absences(); select public.scheduled_reminders();');

-- Every minute: if anything is waiting, ask the `push` Edge Function to send it.
select cron.schedule('hifz-push', '* * * * *', $$
  select net.http_post(
    url := 'https://fkncvpnwvenmhvltxmig.supabase.co/functions/v1/push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', (select value from public.app_secrets where key = 'cron_secret')),
    body := '{}'::jsonb)
  where exists (select 1 from public.notification_queue where sent_at is null and error is null);
$$);
