import "server-only";

import {
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

/** Prefer direct Postgres for DDL — pooler URLs often fail migrations on serverless. */
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
 * Postgres URL for NI Brain DDL (Content Hub schema repair).
 * Prefers NI_BRAIN_DATABASE_URL; otherwise builds from NI_BRAIN_DATABASE_PASSWORD + NI_BRAIN_SUPABASE_URL.
 * Always uses the direct db.<ref>.supabase.co host for reliability (not the session pooler).
 */
export function resolveNiBrainDatabaseUrlForDdl(): string | null {
  const explicit = process.env.NI_BRAIN_DATABASE_URL?.trim();
  if (explicit) return normalizeNiBrainDatabaseUrlForDdl(explicit);

  const password = process.env.NI_BRAIN_DATABASE_PASSWORD?.trim();
  const supabaseUrl = process.env.NI_BRAIN_SUPABASE_URL?.trim();
  if (!password || !supabaseUrl) return null;

  const projectRef = niBrainProjectRefFromSupabaseUrl(supabaseUrl);
  if (!projectRef) return null;

  return buildNiBrainDirectDatabaseUrl({ projectRef, password });
}
