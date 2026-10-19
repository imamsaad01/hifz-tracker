-- Scheduled parent emails. Run once in Supabase → SQL Editor AFTER deploying the notify function.
-- 1. Database → Extensions: enable pg_cron and pg_net.
-- 2. Replace YOUR-PROJECT and YOUR-CRON-SECRET below (the same value as the CRON_SECRET function secret).
-- Times are UTC. 23:00 UTC daily = evening in the Americas/Europe; adjust to suit.

select cron.schedule('hifz-daily-revision-check', '0 23 * * *', $$
  select net.http_post(
    url := 'https://YOUR-PROJECT.supabase.co/functions/v1/notify',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', 'YOUR-CRON-SECRET'),
    body := '{"type":"daily"}'::jsonb);
$$);

select cron.schedule('hifz-weekly-summary', '0 22 * * 0', $$
  select net.http_post(
    url := 'https://YOUR-PROJECT.supabase.co/functions/v1/notify',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', 'YOUR-CRON-SECRET'),
    body := '{"type":"weekly"}'::jsonb);
$$);

-- To stop them: select cron.unschedule('hifz-daily-revision-check'); select cron.unschedule('hifz-weekly-summary');
