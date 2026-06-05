/** Helpers for Supabase connection strings on serverless (Vercel). */

/** Fallback pooler regions when SUPABASE_PROJECT_REGION is unset (project ref → region slug). */
const KNOWN_SUPABASE_POOLER_REGIONS: Record<string, string> = {
  qtesdsxrfggdlxdaraaq: "us-east-2",
};

function parsePostgresUrl(raw: string): URL | null {
  try {
    return new URL(raw.trim());
  } catch {
    return null;
  }
}

export function supabaseProjectRefFromConnectionString(connectionString: string): string | null {
  const url = parsePostgresUrl(connectionString);
  if (!url) return null;
  const fromHost = url.hostname.match(/^db\.([a-z0-9-]+)\.supabase\.co$/i)?.[1];
  if (fromHost) return fromHost;
  const user = decodeURIComponent(url.username);
  if (user.startsWith("postgres.")) return user.slice("postgres.".length);
  return null;
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

function poolerRegionForProjectRef(ref: string): string | null {
  const fromEnv = process.env.SUPABASE_PROJECT_REGION?.trim();
  if (fromEnv) return fromEnv;
  return KNOWN_SUPABASE_POOLER_REGIONS[ref] ?? null;
}

function poolerHostForRegion(region: string): string {
  const explicit = process.env.SUPABASE_POOLER_HOST?.trim();
  if (explicit) return explicit;
  return `aws-1-${region}.pooler.supabase.com`;
}

/**
 * Build a Supabase transaction pooler URL from a direct `db.<ref>.supabase.co` URL.
 * Keeps the password from the direct URL and sets username to `postgres.<ref>`.
 */
export function derivePoolerDatabaseUrlFromDirectSupabaseUrl(directUrl: string): string | null {
  const url = parsePostgresUrl(directUrl);
  if (!url || !isSupabaseDirectDbHost(directUrl)) return null;

  const ref = supabaseProjectRefFromConnectionString(directUrl);
  if (!ref) return null;

  const region = poolerRegionForProjectRef(ref);
  if (!region) return null;

  const pooler = new URL(directUrl);
  pooler.hostname = poolerHostForRegion(region);
  pooler.port = process.env.SUPABASE_POOLER_PORT?.trim() || "6543";
  pooler.username = `postgres.${ref}`;
  pooler.searchParams.set("pgbouncer", "true");
  if (!pooler.searchParams.has("sslmode")) {
    pooler.searchParams.set("sslmode", "require");
  }
  return pooler.toString();
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

  if (isSupabasePoolerHost(databaseUrl)) {
    return databaseUrl;
  }

  if (isSupabaseDirectDbHost(databaseUrl)) {
    const derived = derivePoolerDatabaseUrlFromDirectSupabaseUrl(databaseUrl);
    if (derived) {
      console.warn(
        "[prisma] DATABASE_URL uses Supabase direct host — using derived transaction pooler URL for serverless.",
      );
      return derived;
    }
    console.error(
      "[prisma] DATABASE_URL uses Supabase direct host (db.*.supabase.co). Set SUPABASE_PROJECT_REGION, SUPABASE_DATABASE_POOLER_URL, or point DATABASE_URL at the pooler in Vercel.",
    );
  }

  return databaseUrl;
}
