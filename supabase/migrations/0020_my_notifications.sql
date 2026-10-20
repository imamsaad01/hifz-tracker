-- Everything the app has notified me about (last 60 days), for the bell's history.
create or replace function public.my_notifications(p_limit int default 60) returns table (id bigint, title text, body text, url text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select q.id, q.title, q.body, q.url, q.created_at from public.notification_queue q
  where q.user_id = auth.uid() and q.created_at > now() - interval '60 days'
  order by q.created_at desc limit least(greatest(coalesce(p_limit, 60), 1), 200);
$$;
revoke all on function public.my_notifications(int) from public, anon;
grant execute on function public.my_notifications(int) to authenticated;
