import "server-only";
import pg from "pg";

function normalizeConnectionString(connectionString: string): string {
  try {
    const url = new URL(connectionString);
    url.searchParams.delete("sslmode");
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

/** Prefer direct Postgres (port 5432) for DDL; poolers reject or ignore ALTER TABLE. */
export function directPostgresUrlForDdl(): string | null {
  return process.env.DIRECT_URL?.trim() || null;
}

/**
 * Runs DDL on the direct Postgres URL when available. Falls back to the pooled URL only
 * when DIRECT_URL is unset (local dev).
 */
export async function runDirectPostgresDdl(sql: string): Promise<void> {
  const direct = directPostgresUrlForDdl();
  const fallback = process.env.DATABASE_URL?.trim() || null;
  const raw = direct ?? fallback;
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
