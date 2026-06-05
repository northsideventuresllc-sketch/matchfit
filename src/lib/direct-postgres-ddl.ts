import "server-only";
import pg from "pg";
import {
  isSupabaseDirectDbHost,
  isSupabasePoolerHost,
  pgPoolConfigForConnectionString,
} from "@/lib/supabase-database-url";

function normalizeConnectionString(connectionString: string): string {
  try {
    const url = new URL(connectionString);
    url.searchParams.delete("sslmode");
    url.searchParams.delete("pgbouncer");
    return url.toString();
  } catch {
    return connectionString;
  }
}

function supabaseProjectRefFromUrl(url: URL): string | null {
  const user = decodeURIComponent(url.username);
  const fromUser = user.startsWith("postgres.") ? user.slice("postgres.".length) : null;
  if (fromUser) return fromUser;
  const hostMatch = url.hostname.match(/^db\.([a-z0-9-]+)\.supabase\.co$/i);
  return hostMatch?.[1] ?? null;
}

/** Build Supabase session/direct URLs from the pooled DATABASE_URL when DIRECT_URL is unset. */
export function deriveDirectPostgresUrlFromDatabaseUrl(databaseUrl: string): string | null {
  const raw = databaseUrl.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const projectRef = supabaseProjectRefFromUrl(url);
    const candidates: URL[] = [];

    const sessionPooler = new URL(url.toString());
    sessionPooler.searchParams.delete("pgbouncer");
    if (sessionPooler.port === "6543" || sessionPooler.hostname.includes("pooler.supabase.com")) {
      sessionPooler.port = "5432";
      candidates.push(sessionPooler);
    }

    if (projectRef) {
      const dbHost = new URL(url.toString());
      dbHost.hostname = `db.${projectRef}.supabase.co`;
      dbHost.port = "5432";
      dbHost.username = "postgres";
      dbHost.searchParams.delete("pgbouncer");
      candidates.unshift(dbHost);
    }

    if (url.port === "5432" && !url.searchParams.get("pgbouncer")) {
      candidates.push(url);
    }

    const seen = new Set<string>();
    for (const candidate of candidates) {
      const normalized = normalizeConnectionString(candidate.toString());
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      return normalized;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Postgres URL for schema repair DDL (must be direct/session — not transaction pooler :6543).
 * When Vercel has DATABASE_URL=direct and DIRECT_URL=pooler (swapped), use db.*.supabase.co from DATABASE_URL.
 */
export function directPostgresUrlForDdl(): string | null {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  const directUrl = process.env.DIRECT_URL?.trim();

  if (databaseUrl && isSupabaseDirectDbHost(databaseUrl)) {
    const fromDatabase = deriveDirectPostgresUrlFromDatabaseUrl(databaseUrl);
    if (fromDatabase) return normalizeConnectionString(fromDatabase);
  }

  if (directUrl && isSupabaseDirectDbHost(directUrl)) {
    return normalizeConnectionString(directUrl);
  }

  if (directUrl && !isSupabasePoolerHost(directUrl)) {
    return normalizeConnectionString(directUrl);
  }

  if (databaseUrl) {
    const derived = deriveDirectPostgresUrlFromDatabaseUrl(databaseUrl);
    if (derived) return normalizeConnectionString(derived);
  }

  return null;
}

export function directPostgresUrlSource():
  | "DIRECT_URL"
  | "derived_from_DATABASE_URL"
  | "derived_from_direct_DATABASE_URL"
  | "missing" {
  const databaseUrl = process.env.DATABASE_URL?.trim() ?? "";
  const directUrl = process.env.DIRECT_URL?.trim();

  if (databaseUrl && isSupabaseDirectDbHost(databaseUrl)) {
    return "derived_from_direct_DATABASE_URL";
  }
  if (directUrl && !isSupabasePoolerHost(directUrl)) return "DIRECT_URL";
  if (deriveDirectPostgresUrlFromDatabaseUrl(databaseUrl)) {
    return "derived_from_DATABASE_URL";
  }
  return "missing";
}

/**
 * Runs DDL on the direct Postgres URL when available. Falls back to the pooled URL only
 * when DIRECT_URL is unset (local dev).
 */
export async function runDirectPostgresDdl(sql: string): Promise<void> {
  const raw = directPostgresUrlForDdl();
  if (!raw) {
    throw new Error("DIRECT_URL or DATABASE_URL is required for schema repair DDL.");
  }

  const connectionString = normalizeConnectionString(raw);
  const pool = new pg.Pool({
    ...pgPoolConfigForConnectionString(connectionString),
    max: 1,
  });

  try {
    await pool.query(sql);
  } finally {
    await pool.end().catch(() => {});
  }
}
