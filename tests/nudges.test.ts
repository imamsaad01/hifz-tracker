// Students get only the 3 weekly nudges; staff notifications pass through (supabase/migrations/0024).
import { it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';

const ORG = '00000000-0000-0000-0000-000000000001', KID = '00000000-0000-0000-0000-0000000000aa', ADMIN = '00000000-0000-0000-0000-0000000000bb';
it('keeps students quiet except for the weekly nudge, once a day', async () => {
  const db = new PGlite();
  await db.exec(`create type public.member_role as enum ('admin','teacher','student','parent');
    create table public.organizations (id uuid primary key, timezone text, deleted_at timestamptz);
    create table public.organization_members (org_id uuid, user_id uuid, role public.member_role, extra_roles public.member_role[] default '{}');
    create table public.students (id uuid primary key, org_id uuid, user_id uuid, name text, archived_at timestamptz);
    create table public.notification_queue (id serial, user_id uuid, title text, body text, url text);
    create table public.reminders_sent (key text primary key, at timestamptz default now());
    create function public.org_local_now(org uuid) returns timestamp language sql as $$ select timestamp '2026-11-23 19:10' $$;
    create function public.enqueue(p_user uuid, p_title text, p_body text, p_url text) returns void language sql as $$ insert into public.notification_queue (user_id,title,body,url) values (p_user,p_title,p_body,p_url) $$;
    create schema cron; create table cron.job (jobname text);
    create function cron.schedule(a text, b text, c text) returns int language sql as $$ select 1 $$;
    create function cron.unschedule(a text) returns bool language sql as $$ select true $$;
    create role anon; create role authenticated;
    insert into public.organizations values ('${ORG}','America/Toronto',null);
    insert into public.organization_members values ('${ORG}','${KID}','student','{}'),('${ORG}','${ADMIN}','admin','{}');
    insert into public.students values ('00000000-0000-0000-0000-0000000000c1','${ORG}','${KID}','Yusuf Ali',null);`);
  await db.exec(fs.readFileSync('supabase/migrations/0024_three_nudges_a_week.sql', 'utf8'));
  await db.exec(`select public.enqueue('${KID}','Did you do today''s revision?','x','#/'); select public.enqueue('${ADMIN}','Lesson to sign off','x','#/');`);
  expect((await db.query<{ n: number }>(`select public.student_nudges() as n`)).rows[0].n).toBe(1); // Monday 7 pm
  expect((await db.query<{ n: number }>(`select public.student_nudges() as n`)).rows[0].n).toBe(0); // not twice
  await db.exec(`select public.enqueue('${KID}','Old revision this week','x','#/')`);
  const q = await db.query<{ title: string; body: string }>(`select title, body from public.notification_queue order by id`);
  expect(q.rows.map(r => r.title)).toEqual(['Lesson to sign off', 'New week, new stars ⭐']);
  expect(q.rows[1].body).toContain('Salaam Yusuf');
}, 60000);
