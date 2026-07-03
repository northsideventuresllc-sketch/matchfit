import { NextResponse } from "next/server";
import { z } from "zod";
import pg from "pg";
import { directPostgresUrlForDdl } from "@/lib/direct-postgres-ddl";
import { pgPoolConfigForConnectionString } from "@/lib/supabase-database-url";
import { clearPlatformSecretCache } from "@/lib/platform-secrets";
import { resolveInternalToolsSecret } from "@/lib/internal-tools-auth";
import { resetHydratePlatformEnvCache } from "@/lib/hydrate-platform-env";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  anthropicApiKey: z.string().startsWith("sk-ant-"),
  anthropicModel: z.string().min(1).optional(),
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
 * Bootstrap or rotate Anthropic admin AI key in platform_secrets.
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
      return NextResponse.json({ error: "Invalid Anthropic payload." }, { status: 400 });
    }

    await upsertPlatformSecret("ANTHROPIC_API_KEY", body.anthropicApiKey);
    await upsertPlatformSecret(
      "ANTHROPIC_ADMIN_ANALYTICS_MODEL",
      body.anthropicModel?.trim() || "claude-sonnet-4-6",
    );
    clearPlatformSecretCache();
    resetHydratePlatformEnvCache();

    return NextResponse.json({ ok: true, message: "Anthropic API key stored in platform_secrets." });
  } catch (e) {
    console.error("[bootstrap-platform-anthropic]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message.slice(0, 240) : "Bootstrap failed." },
      { status: 500 },
    );
  }
}
