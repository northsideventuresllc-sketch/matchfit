import "server-only";

import {
  isSupabaseDirectDbHost,
  isSupabasePoolerHost,
  supabaseProjectRefFromConnectionString,
} from "@/lib/supabase-database-url";

export const NI_BRAIN_PROJECT_REF = "kxijunwgbrlfzvgkhklo";

const KNOWN_NI_BRAIN_POOLER_REGIONS: Record<string, string> = {
  [NI_BRAIN_PROJECT_REF]: "us-east-1",
};

/** Extract Supabase project ref from https://<ref>.supabase.co */
export function niBrainProjectRefFromSupabaseUrl(supabaseUrl: string): string | null {
  try {
    const host = new URL(supabaseUrl.trim()).hostname;
    const match = host.match(/^([a-z0-9-]+)\.supabase\.co$/i);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

export function buildNiBrainDirectDatabaseUrl(args: { projectRef: string; password: string }): string {
  const encoded = encodeURIComponent(args.password);
  return `postgresql://postgres:${encoded}@db.${args.projectRef}.supabase.co:5432/postgres`;
}

export function buildNiBrainSessionPoolerDatabaseUrl(args: {
  projectRef: string;
  password: string;
  region?: string;
}): string {
  const region =
    args.region?.trim() ||
    process.env.NI_BRAIN_PROJECT_REGION?.trim() ||
    KNOWN_NI_BRAIN_POOLER_REGIONS[args.projectRef] ||
    "us-east-1";
  const host = process.env.NI_BRAIN_POOLER_HOST?.trim() || `aws-1-${region}.pooler.supabase.com`;
  const encoded = encodeURIComponent(args.password);
  return `postgresql://postgres.${args.projectRef}:${encoded}@${host}:5432/postgres`;
}

/** True when serverless should use session pooler (direct db.* is often IPv6-only → ENOTFOUND on Vercel). */
export function shouldPreferNiBrainSessionPoolerForDdl(): boolean {
  if (process.env.NI_BRAIN_DDL_USE_POOLER === "0") return false;
  if (process.env.NI_BRAIN_DDL_USE_POOLER === "1") return true;
  return Boolean(process.env.VERCEL);
}

/** Prefer direct Postgres for local/admin DDL when IPv6 or VPN reaches db.*. */
export function normalizeNiBrainDatabaseUrlForDdl(databaseUrl: string): string {
  const trimmed = databaseUrl.trim();
  if (!isSupabasePoolerHost(trimmed)) return trimmed;

  const projectRef = supabaseProjectRefFromConnectionString(trimmed);
  if (!projectRef) return trimmed;

  try {
    const parsed = new URL(trimmed);
    const password = decodeURIComponent(parsed.password);
    if (password) {
      return buildNiBrainDirectDatabaseUrl({ projectRef, password });
    }
  } catch {
    // keep original URL
  }

  return trimmed;
}

/**
 * Convert a direct db.<ref>.supabase.co URL to the session pooler (port 5432).
 * Session mode supports DDL; transaction pooler (:6543) does not.
 */
export function normalizeNiBrainDatabaseUrlForSessionPooler(databaseUrl: string): string {
  const trimmed = databaseUrl.trim();
  if (isSupabasePoolerHost(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      // Force session mode (5432) even if a transaction pooler URL was stored.
      if (parsed.port === "6543") parsed.port = "5432";
      parsed.searchParams.delete("pgbouncer");
      return parsed.toString();
    } catch {
      return trimmed;
    }
  }

  if (!isSupabaseDirectDbHost(trimmed)) return trimmed;

  const projectRef = supabaseProjectRefFromConnectionString(trimmed);
  if (!projectRef) return trimmed;

  try {
    const parsed = new URL(trimmed);
    const password = decodeURIComponent(parsed.password);
    if (password) {
      return buildNiBrainSessionPoolerDatabaseUrl({ projectRef, password });
    }
  } catch {
    // keep original URL
  }

  return trimmed;
}

/**
 * Postgres URL for NI Brain DDL (Content Hub schema repair).
 * Prefers NI_BRAIN_DATABASE_URL; otherwise builds from NI_BRAIN_DATABASE_PASSWORD + NI_BRAIN_SUPABASE_URL.
 * On Vercel, uses the session pooler (IPv4) because db.<ref>.supabase.co is often IPv6-only.
 */
export function resolveNiBrainDatabaseUrlForDdl(): string | null {
  const preferPooler = shouldPreferNiBrainSessionPoolerForDdl();
  const explicit = process.env.NI_BRAIN_DATABASE_URL?.trim();
  if (explicit) {
    return preferPooler
      ? normalizeNiBrainDatabaseUrlForSessionPooler(explicit)
      : normalizeNiBrainDatabaseUrlForDdl(explicit);
  }

  const password = process.env.NI_BRAIN_DATABASE_PASSWORD?.trim();
  const supabaseUrl = process.env.NI_BRAIN_SUPABASE_URL?.trim();
  if (!password || !supabaseUrl) return null;

  const projectRef = niBrainProjectRefFromSupabaseUrl(supabaseUrl);
  if (!projectRef) return null;

  return preferPooler
    ? buildNiBrainSessionPoolerDatabaseUrl({ projectRef, password })
    : buildNiBrainDirectDatabaseUrl({ projectRef, password });
}

/** Alternate DDL URL when the primary host fails DNS/connectivity (ENOTFOUND / IPv6). */
export function resolveNiBrainDatabaseUrlFallbackForDdl(primaryUrl: string): string | null {
  const trimmed = primaryUrl.trim();
  if (isSupabaseDirectDbHost(trimmed)) {
    const pooler = normalizeNiBrainDatabaseUrlForSessionPooler(trimmed);
    return pooler !== trimmed ? pooler : null;
  }
  if (isSupabasePoolerHost(trimmed)) {
    const direct = normalizeNiBrainDatabaseUrlForDdl(trimmed);
    return direct !== trimmed ? direct : null;
  }
  return null;
}
