import "server-only";

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
  const host = process.env.NI_BRAIN_POOLER_HOST?.trim() || `aws-0-${region}.pooler.supabase.com`;
  const encoded = encodeURIComponent(args.password);
  return `postgresql://postgres.${args.projectRef}:${encoded}@${host}:5432/postgres`;
}

/**
 * Postgres URL for NI Brain DDL (Content Hub schema repair).
 * Prefers NI_BRAIN_DATABASE_URL; otherwise builds from NI_BRAIN_DATABASE_PASSWORD + NI_BRAIN_SUPABASE_URL.
 */
export function resolveNiBrainDatabaseUrlForDdl(): string | null {
  const explicit = process.env.NI_BRAIN_DATABASE_URL?.trim();
  if (explicit) return explicit;

  const password = process.env.NI_BRAIN_DATABASE_PASSWORD?.trim();
  const supabaseUrl = process.env.NI_BRAIN_SUPABASE_URL?.trim();
  if (!password || !supabaseUrl) return null;

  const projectRef = niBrainProjectRefFromSupabaseUrl(supabaseUrl);
  if (!projectRef) return null;

  const onVercel = process.env.VERCEL === "1" || Boolean(process.env.VERCEL_ENV);
  if (onVercel) {
    return buildNiBrainSessionPoolerDatabaseUrl({ projectRef, password });
  }

  return buildNiBrainDirectDatabaseUrl({ projectRef, password });
}
