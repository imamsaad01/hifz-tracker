-- A phone can be shared (parent + children, or one person with two accounts).
-- Each account keeps its own row for the same device endpoint.
alter table public.push_subscriptions drop constraint if exists push_subscriptions_endpoint_key;
create unique index if not exists push_subscriptions_user_endpoint on public.push_subscriptions (user_id, endpoint);
create index if not exists push_subscriptions_endpoint on public.push_subscriptions (endpoint);
