import "server-only";

import pg from "pg";
import { directPostgresUrlForDdl } from "@/lib/direct-postgres-ddl";
import {
  isSupabasePoolerHost,
  pgPoolConfigForConnectionString,
} from "@/lib/supabase-database-url";

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { value: string; expiresAt: number }>();
const NEGATIVE_CACHE_TTL_MS = 30 * 1000;
const negativeCache = new Map<string, number>();

/** True when Vercel still has the placeholder test secret instead of a live key. */
export function isPlaceholderStripeSecretKey(key: string | null | undefined): boolean {
  const value = key?.trim();
  if (!value) return true;
  if (value.includes("...")) return true;
  if (value.endsWith("_key") && value.startsWith("sk_test_")) return true;
  if (process.env.VERCEL_ENV === "production" && value.startsWith("sk_test_")) return true;
  return false;
}

export function isPlaceholderStripePublishableKey(key: string | null | undefined): boolean {
  const value = key?.trim();
  if (!value) return true;
  if (value.includes("...")) return true;
  if (process.env.VERCEL_ENV === "production" && value.startsWith("pk_test_")) return true;
  return false;
}

export function isPlaceholderStripeWebhookSecret(key: string | null | undefined): boolean {
  const value = key?.trim();
  if (!value) return true;
  if (value.includes("...")) return true;
  if (value === "whsec_test" || value.startsWith("whsec_test_")) {
    return process.env.VERCEL_ENV === "production";
  }
  return false;
}

/** True when Vercel still has a placeholder/invalid Resend API key. */
export function isPlaceholderResendApiKey(key: string | null | undefined): boolean {
  const value = key?.trim();
  if (!value) return true;
  if (value.includes("...")) return true;
  if (value.endsWith("_key") && value.startsWith("re_")) return true;
  if (process.env.VERCEL_ENV === "production" && value.startsWith("re_test_")) return true;
  return false;
}

export function isPlaceholderResendFromEmail(value: string | null | undefined): boolean {
  const email = value?.trim();
  if (!email) return true;
  if (email.includes("...")) return true;
  if (email.includes("@resend.dev")) return process.env.VERCEL_ENV === "production";
  return false;
}

function platformSecretConnectionCandidates(): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (raw: string | null | undefined) => {
    const value = raw?.trim();
    if (!value || seen.has(value)) return;
    seen.add(value);
    out.push(value);
  };

  push(directPostgresUrlForDdl());

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (databaseUrl && isSupabasePoolerHost(databaseUrl)) {
    // Session mode first, then the configured pooler URL (transaction mode still supports simple SELECTs).
    try {
      const session = new URL(databaseUrl);
      session.port = "5432";
      session.searchParams.delete("pgbouncer");
      push(session.toString());
    } catch {
      // ignore
    }
    push(databaseUrl);
  }

  return out;
}

async function queryWithConnection(connectionString: string, key: string): Promise<string | null> {
  const pool = new pg.Pool({
    ...pgPoolConfigForConnectionString(connectionString),
    max: 1,
  });

  try {
    const result = await pool.query<{ value: string }>(
      `SELECT value FROM public.platform_secrets WHERE key = $1 LIMIT 1`,
      [key],
    );
    return result.rows[0]?.value?.trim() ?? null;
  } finally {
    await pool.end().catch(() => {});
  }
}

async function queryPlatformSecretFromDatabase(key: string): Promise<string | null> {
  const candidates = platformSecretConnectionCandidates();
  if (!candidates.length) return null;

  for (const connectionString of candidates) {
    try {
      const value = await queryWithConnection(connectionString, key);
      if (value) return value;
    } catch {
      // Try the next reachable Postgres URL (common on Vercel when db.* is blocked).
    }
  }
  return null;
}

export async function readPlatformSecret(key: string): Promise<string | null> {
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expiresAt > now) return hit.value;
  const neg = negativeCache.get(key);
  if (neg && neg > now) return null;

  const value = await queryPlatformSecretFromDatabase(key);
  if (value) {
    cache.set(key, { value, expiresAt: now + CACHE_TTL_MS });
    negativeCache.delete(key);
  } else {
    negativeCache.set(key, now + NEGATIVE_CACHE_TTL_MS);
  }
  return value;
}

/** Env first; falls back to `platform_secrets` when env is missing or a known placeholder. */
export async function resolvePlatformSecret(
  key: string,
  envValue: string | null | undefined,
  isPlaceholder: (value: string | null | undefined) => boolean,
): Promise<string | null> {
  const trimmed = envValue?.trim();
  if (trimmed && !isPlaceholder(trimmed)) return trimmed;
  return readPlatformSecret(key);
}

/** Synchronous env-only read (legacy). */
export function resolvePlatformSecretFromEnv(
  envValue: string | null | undefined,
  isPlaceholder: (value: string | null | undefined) => boolean,
): string | null {
  const trimmed = envValue?.trim();
  if (trimmed && !isPlaceholder(trimmed)) return trimmed;
  return null;
}

export function clearPlatformSecretCache(): void {
  cache.clear();
  negativeCache.clear();
}
