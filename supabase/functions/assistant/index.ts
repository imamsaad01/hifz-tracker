// Supabase Edge Function (Deno): the admin assistant. Admins only. It never changes data itself:
// it asks Claude what to do and returns proposed actions; the app shows each one and only runs it when the admin taps "Do it"
// (through the normal app permissions). Needs the secret ANTHROPIC_API_KEY (Supabase → Edge Functions → Secrets).
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const TOOLS = [
  { name: 'update_student', description: 'Change a student\'s details. Only include fields that change.', input_schema: { type: 'object', properties: {
    student_id: { type: 'string' }, name: { type: 'string' }, lesson_pages: { type: 'number', description: 'pages per new lesson: 0.5, 1, 1.5, 2, 3, 4 or 5' },
    daily_ayahs: { type: 'number', description: 'ayahs per lesson when not counting in pages' }, goal: { type: 'string', description: 'one of the goals listed in the context' },
    direction: { type: 'string', enum: ['back', 'forward'], description: 'back = from An-Nas backwards, forward = from Al-Fatihah' } }, required: ['student_id'] } },
  { name: 'move_student', description: 'Put a student in a halaqah (removes them from their other halaqahs).', input_schema: { type: 'object', properties: { student_id: { type: 'string' }, halaqah_id: { type: 'string' } }, required: ['student_id', 'halaqah_id'] } },
  { name: 'set_revision_times_per_week', description: 'How many times a week students do Old revision, at their own time.', input_schema: { type: 'object', properties: { times: { type: 'integer', minimum: 1, maximum: 7 } }, required: ['times'] } },
  { name: 'post_announcement', description: 'Post an announcement to everyone or to one halaqah.', input_schema: { type: 'object', properties: { title: { type: 'string' }, body: { type: 'string' }, halaqah_id: { type: 'string', description: 'omit for everyone' } }, required: ['title', 'body'] } },
  { name: 'decide_join_request', description: 'Approve or decline a request to join a halaqah.', input_schema: { type: 'object', properties: { request_id: { type: 'string' }, approve: { type: 'boolean' } }, required: ['request_id', 'approve'] } },
  { name: 'mark_attendance', description: 'Record attendance for a student on a date.', input_schema: { type: 'object', properties: { student_id: { type: 'string' }, date: { type: 'string', description: 'YYYY-MM-DD' }, status: { type: 'string', enum: ['present', 'late', 'absent', 'excused'] } }, required: ['student_id', 'date', 'status'] } },
  { name: 'open_page', description: 'Open a page of the app for the admin.', input_schema: { type: 'object', properties: { page: { type: 'string', description: 'today | students | live | attendance | halaqahs | calendar | tasks | reports | settings | student:<student_id>' } }, required: ['page'] } },
];

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  const key = Deno.env.get('ANTHROPIC_API_KEY');
  if (!key) return json({ error: 'not_configured' }, 503);
  const auth = req.headers.get('Authorization') ?? '';
  const sb = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  let body: { orgId: string; messages: unknown[]; context: string };
  try { body = await req.json(); } catch { return json({ error: 'bad request' }, 400); }
  const { data: isAdmin } = await sb.rpc('is_admin', { org: body.orgId });
  if (!isAdmin) return json({ error: 'Only the program admin can use the assistant.' }, 403);
  if (!Array.isArray(body.messages) || body.messages.length > 40) return json({ error: 'bad request' }, 400);
  const system = `You are the assistant inside "Hifz Tracker", helping the admin of a Qur'an memorisation (hifz) program make quick changes.
Use the tools to propose changes; the admin confirms each one before it happens, so propose exactly what they asked for.
Only use student, halaqah and request ids that appear in the context. If a name matches more than one student, or the request is unclear, ask a short question instead of guessing.
For questions about the data in the context, answer directly and briefly. Use plain English. Keep replies to one to three short sentences.
Context (current data):
${String(body.context ?? '').slice(0, 30000)}`;
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: Deno.env.get('ASSISTANT_MODEL') ?? 'claude-haiku-5-5', max_tokens: 700, system, tools: TOOLS, messages: body.messages }),
  });
  const out = await r.json();
  if (!r.ok) return json({ error: out?.error?.message ?? 'The assistant is unavailable right now.' }, 502);
  return json({ content: out.content, stop_reason: out.stop_reason });
});
