import postgres, { type Sql } from "postgres";

export type QueryResult = { rows: Record<string, unknown>[] };

const TABLES = ["users", "sessions", "calls", "transcript_lines"] as const;

function usesPostgres(url: string): boolean {
  return /^(postgres|postgresql):\/\//.test(url);
}

export function dbSchema(): string {
  return process.env.OHC_DB_SCHEMA?.trim() || process.env.OSP_DB_SCHEMA?.trim() || "ohc";
}

function qualify(sql: string): string {
  const schema = dbSchema();
  if (!schema) return sql;
  const q = `"${schema.replace(/"/g, "")}"`;
  let next = sql;
  for (const table of TABLES) {
    const re = new RegExp(`\\b${table}\\b`, "g");
    next = next.replace(re, `${q}.${table}`);
  }
  return next;
}

function toPgPlaceholders(sql: string): string {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

function sslFor(url: string) {
  try {
    const parsed = new URL(url.replace(/^postgres:\/\//, "postgresql://"));
    const host = parsed.hostname.toLowerCase();
    const mode = (parsed.searchParams.get("sslmode") ?? "").toLowerCase();
    if (mode === "disable") return false;
    if (host === "localhost" || host === "127.0.0.1") return false;
    if (mode === "require" || host.endsWith(".supabase.co") || host.endsWith(".pooler.supabase.com")) {
      return { rejectUnauthorized: false };
    }
    return { rejectUnauthorized: false };
  } catch {
    return false;
  }
}

function stripSslMode(url: string): string {
  try {
    const parsed = new URL(url.replace(/^postgres:\/\//, "postgresql://"));
    parsed.searchParams.delete("sslmode");
    const next = parsed.toString().replace(/^postgresql:\/\//, "postgres://");
    return next.endsWith("?") ? next.slice(0, -1) : next;
  } catch {
    return url;
  }
}

function runtimeUrl(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (!url || !usesPostgres(url)) {
    throw new Error(
      "DATABASE_URL must be a Postgres URL (schema defaults to ohc).",
    );
  }
  return url;
}

function adminUrl(): string {
  return process.env.DATABASE_ADMIN_URL?.trim() || runtimeUrl();
}

let pg: Sql | null = null;
let pgAdmin: Sql | null = null;

function pgClient(url: string, cache: "runtime" | "admin"): Sql {
  if (cache === "runtime" && pg) return pg;
  if (cache === "admin" && pgAdmin) return pgAdmin;
  const sql = postgres(stripSslMode(url), {
    ssl: sslFor(url),
    max: 5,
    prepare: false,
    fetch_types: false,
    connect_timeout: 10,
    idle_timeout: 20,
  });
  if (cache === "runtime") pg = sql;
  else pgAdmin = sql;
  return sql;
}

export async function execute(query: { sql: string; args?: unknown[] }): Promise<QueryResult> {
  const sql = qualify(query.sql);
  const args = query.args ?? [];
  const rows = await pgClient(runtimeUrl(), "runtime").unsafe(toPgPlaceholders(sql), args as never[]);
  return { rows: rows as unknown as Record<string, unknown>[] };
}

export function db() {
  return { execute };
}

function postgresDdl(schema: string): string {
  const q = `"${schema.replace(/"/g, "")}"`;
  return `
CREATE SCHEMA IF NOT EXISTS ${q};
CREATE TABLE IF NOT EXISTS ${q}.users (
  id TEXT PRIMARY KEY,
  email TEXT,
  name TEXT NOT NULL,
  created_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS ${q}.sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  queue_id TEXT NOT NULL,
  queue_name TEXT NOT NULL,
  contacts_json TEXT NOT NULL,
  idx INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  ended_at BIGINT
);
CREATE TABLE IF NOT EXISTS ${q}.calls (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  contact_json TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at BIGINT NOT NULL,
  ended_at BIGINT,
  twilio_sid TEXT
);
CREATE TABLE IF NOT EXISTS ${q}.transcript_lines (
  id TEXT PRIMARY KEY,
  call_id TEXT NOT NULL,
  role TEXT NOT NULL,
  text TEXT NOT NULL,
  source TEXT NOT NULL,
  at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user ON ${q}.sessions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS calls_session ON ${q}.calls(session_id, started_at);
CREATE INDEX IF NOT EXISTS lines_call ON ${q}.transcript_lines(call_id, at);
`;
}

let migrated = false;

export async function migrate() {
  if (process.env.OHC_SKIP_MIGRATE === "1" || migrated) return;
  const schema = dbSchema();
  const admin = pgClient(adminUrl(), "admin");
  await admin.unsafe(postgresDdl(schema));
  try {
    const q = `"${schema.replace(/"/g, "")}"`;
    await admin.unsafe(`GRANT USAGE ON SCHEMA ${q} TO capveon_app`);
    await admin.unsafe(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA ${q} TO capveon_app`,
    );
  } catch {
    /* local roles may already own the schema */
  }
  migrated = true;
}

export async function closeDb() {
  if (pg) {
    await pg.end({ timeout: 2 });
    pg = null;
  }
  if (pgAdmin) {
    await pgAdmin.end({ timeout: 2 });
    pgAdmin = null;
  }
}
