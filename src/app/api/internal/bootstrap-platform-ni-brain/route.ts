import { NextResponse } from "next/server";
import { z } from "zod";
import pg from "pg";
import { directPostgresUrlForDdl } from "@/lib/direct-postgres-ddl";
import { pgPoolConfigForConnectionString } from "@/lib/supabase-database-url";
import { clearPlatformSecretCache } from "@/lib/platform-secrets";
import { resolveInternalToolsSecret } from "@/lib/internal-tools-auth";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  niBrainSupabaseUrl: z.string().url().includes("supabase.co"),
  niBrainServiceRoleKey: z.string().min(20),
});

async function upsertPlatformSecret(key: string, value: string): Promise<void> {
  const raw = directPostgresUrlForDdl();
  if (!raw) throw new Error("No direct Postgres URL available for platform_secrets bootstrap.");

  const pool = new pg.Pool({
    ...pgPoolConfigForConnectionString(raw),
    max: 1,
  });

  try {
    await pool.query(
      `CREATE TABLE IF NOT EXISTS public.platform_secrets (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    );
    await pool.query(
      `INSERT INTO public.platform_secrets (key, value, "updatedAt")
       VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, "updatedAt" = NOW()`,
      [key, value],
    );
  } finally {
    await pool.end().catch(() => {});
  }
}

/**
 * Bootstrap or rotate NI Brain keys in platform_secrets.
 * Protect with `MATCHFIT_INTERNAL_TOOLS_SECRET` (see `.env.example`).
 */
export async function POST(req: Request) {
  try {
    const secret = await resolveInternalToolsSecret();
    if (!secret) {
      return NextResponse.json({ error: "Internal tools are not configured." }, { status: 503 });
    }
    const auth = req.headers.get("authorization")?.trim() ?? "";
    const bearer = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : "";
    if (bearer !== secret) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    let body: z.infer<typeof bodySchema>;
    try {
      body = bodySchema.parse(await req.json());
    } catch {
      return NextResponse.json({ error: "Invalid NI Brain payload." }, { status: 400 });
    }

    await upsertPlatformSecret("NI_BRAIN_SUPABASE_URL", body.niBrainSupabaseUrl);
    await upsertPlatformSecret("NI_BRAIN_SUPABASE_SERVICE_ROLE_KEY", body.niBrainServiceRoleKey);
    clearPlatformSecretCache();

    return NextResponse.json({ ok: true, message: "NI Brain keys stored in platform_secrets." });
  } catch (e) {
    console.error("[bootstrap-platform-ni-brain]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message.slice(0, 240) : "Bootstrap failed." },
      { status: 500 },
    );
  }
}
