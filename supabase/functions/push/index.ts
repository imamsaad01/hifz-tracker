// Supabase Edge Function (Deno): delivers queued phone notifications (Web Push).
// Called every minute by pg_cron (supabase/cron_push.sql) with header x-cron-secret.
// Keys live in the database (public.app_secrets, readable only by the service role through push_config()).
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
// @ts-types="npm:@types/web-push@3.6.4"
import webpush from 'npm:web-push@3.6.7';

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async req => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  const db = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } });
  const { data: cfg, error: cfgErr } = await db.rpc('push_config');
  if (cfgErr || !cfg) return json({ error: cfgErr?.message ?? 'no config' }, 500);
  const c = cfg as Record<string, string>;
  if (!c.cron_secret || req.headers.get('x-cron-secret') !== c.cron_secret) return json({ error: 'Forbidden' }, 403);
  webpush.setVapidDetails(c.vapid_subject || 'mailto:admin@example.com', c.vapid_public, c.vapid_private);

  const { data: queue, error } = await db.from('notification_queue').select('*').is('sent_at', null).is('error', null).order('created_at').limit(300);
  if (error) return json({ error: error.message }, 500);
  if (!queue?.length) return json({ sent: 0 });
  const users = [...new Set(queue.map(q => q.user_id))];
  const { data: subs } = await db.from('push_subscriptions').select('*').in('user_id', users);
  let sent = 0, skipped = 0; const dead: string[] = [];
  for (const q of queue) {
    const mine = (subs ?? []).filter(s => s.user_id === q.user_id && !dead.includes(s.id));
    let ok = false; let lastErr = '';
    for (const s of mine) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ title: q.title, body: q.body ?? '', url: q.url ?? './' }), { TTL: 60 * 60 * 12 });
        ok = true;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) dead.push(s.id); else lastErr = `${code ?? ''} ${(e as Error).message}`.slice(0, 200);
      }
    }
    if (ok) { sent++; await db.from('notification_queue').update({ sent_at: new Date().toISOString() }).eq('id', q.id); }
    else { skipped++; await db.from('notification_queue').update({ error: mine.length ? lastErr || 'subscription expired' : 'no device turned on' }).eq('id', q.id); }
  }
  if (dead.length) await db.from('push_subscriptions').delete().in('id', dead);
  return json({ sent, skipped, removedDevices: dead.length });
});
