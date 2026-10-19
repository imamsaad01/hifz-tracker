// One small data interface, two implementations:
//  • supabaseBackend — production: Supabase Auth (Google) + PostgREST + RPC, protected by RLS.
//  • pgliteBackend   — preview: the SAME migrations and functions running in a real Postgres (PGlite) in the browser.
export type Filter =
  | { op: 'eq' | 'neq' | 'gte' | 'lte' | 'gt' | 'lt'; col: string; value: unknown }
  | { op: 'in'; col: string; value: unknown[] }
  | { op: 'is'; col: string; value: null }
  | { op: 'not_is'; col: string; value: null };
export interface Query { table: string; columns?: string; where?: Filter[]; order?: Array<[string, 'asc' | 'desc']>; limit?: number }
export interface AuthUser { id: string; email: string | null; name: string | null }
export interface DemoPersona { id: string; label: string; description: string }

export interface Backend {
  kind: 'live' | 'preview';
  getUser(): Promise<AuthUser | null>;
  onAuthChange(cb: (u: AuthUser | null) => void): () => void;
  signInWithGoogle?(): Promise<void>;
  personas?: DemoPersona[];
  signInAs?(personaId: string): Promise<void>;
  resetPreview?(): Promise<void>;
  signOut(): Promise<void>;
  select<T>(q: Query): Promise<T[]>;
  insert<T>(table: string, row: Record<string, unknown>): Promise<T>;
  update(table: string, patch: Record<string, unknown>, where: Filter[]): Promise<number>;
  remove(table: string, where: Filter[]): Promise<number>;
  rpc<T>(fn: string, args: Record<string, unknown>): Promise<T>;
  invoke?(fn: string, body: Record<string, unknown>): Promise<unknown>;
  subscribe?(tables: string[], cb: () => void): () => void;
}
export class ApiError extends Error {
  constructor(message: string, public code?: string) { super(message); }
}
/** Turn database errors into sentences people can act on. */
export function friendly(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/violates row-level security|permission denied|42501/i.test(msg)) return 'You do not have permission to do that.';
  if (/duplicate key|23505|already exists/i.test(msg)) return 'That is already saved.';
  if (/Failed to fetch|NetworkError|network/i.test(msg)) return 'No connection. Your entry is kept; try again when you are online.';
  return msg.replace(/^.*?ERROR:\s*/, '');
}
