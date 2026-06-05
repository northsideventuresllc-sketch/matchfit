/** Helpers for Supabase connection strings on serverless (Vercel). */

function parsePostgresUrl(raw: string): URL | null {
  try {
    return new URL(raw.trim());
  } catch {
    return null;
  }
}

/** True when the host is `db.<project-ref>.supabase.co` (direct Postgres, not ideal for Prisma on Vercel). */
export function isSupabaseDirectDbHost(connectionString: string): boolean {
  const url = parsePostgresUrl(connectionString);
  if (!url) return false;
  return /^db\.[a-z0-9-]+\.supabase\.co$/i.test(url.hostname);
}

/** True when the host is a Supabase Supavisor pooler endpoint. */
export function isSupabasePoolerHost(connectionString: string): boolean {
  const url = parsePostgresUrl(connectionString);
  if (!url) return false;
  return url.hostname.includes("pooler.supabase.com");
}

/**
 * Resolve the URL Prisma should use at runtime.
 * Prefers the pooler when env vars were swapped or when an explicit override is set.
 */
export function resolvePrismaDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for Prisma.");
  }

  const poolerOverride = process.env.SUPABASE_DATABASE_POOLER_URL?.trim();
  if (poolerOverride) {
    return poolerOverride;
  }

  const directUrl = process.env.DIRECT_URL?.trim();
  if (directUrl && isSupabaseDirectDbHost(databaseUrl) && isSupabasePoolerHost(directUrl)) {
    console.warn(
      "[prisma] DATABASE_URL points at Supabase direct host while DIRECT_URL looks like the pooler — using DIRECT_URL for Prisma.",
    );
    return directUrl;
  }

  if (isSupabaseDirectDbHost(databaseUrl) && isSupabasePoolerHost(databaseUrl)) {
    return databaseUrl;
  }

  if (isSupabaseDirectDbHost(databaseUrl)) {
    console.error(
      "[prisma] DATABASE_URL uses Supabase direct host (db.*.supabase.co). Set DATABASE_URL to the Supabase pooler URL on Vercel, or set SUPABASE_DATABASE_POOLER_URL.",
    );
  }

  return databaseUrl;
}
