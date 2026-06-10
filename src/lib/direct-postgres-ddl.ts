import "server-only";
import pg from "pg";

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

function isSupabaseHost(connectionString: string): boolean {
  try {
    const host = new URL(connectionString).hostname;
    return host.includes("supabase.com") || host.includes("supabase.co");
  } catch {
    return false;
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

/** Prefer DIRECT_URL, then a 5432 Supabase URL derived from DATABASE_URL. */
export function directPostgresUrlForDdl(): string | null {
  const explicit = process.env.DIRECT_URL?.trim();
  if (explicit) return normalizeConnectionString(explicit);
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) return null;
  return deriveDirectPostgresUrlFromDatabaseUrl(databaseUrl);
}

export function directPostgresUrlSource(): "DIRECT_URL" | "derived_from_DATABASE_URL" | "missing" {
  if (process.env.DIRECT_URL?.trim()) return "DIRECT_URL";
  if (deriveDirectPostgresUrlFromDatabaseUrl(process.env.DATABASE_URL ?? "")) {
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
    connectionString,
    ssl: isSupabaseHost(raw) ? { rejectUnauthorized: false } : undefined,
    max: 1,
  });

  try {
    await pool.query(sql);
  } finally {
    await pool.end().catch(() => {});
  }
}
