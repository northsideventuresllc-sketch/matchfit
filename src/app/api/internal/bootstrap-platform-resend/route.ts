import { NextResponse } from "next/server";
import { z } from "zod";
import pg from "pg";
import { directPostgresUrlForDdl } from "@/lib/direct-postgres-ddl";
import { pgPoolConfigForConnectionString } from "@/lib/supabase-database-url";
import { clearPlatformSecretCache } from "@/lib/platform-secrets";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  resendApiKey: z.string().startsWith("re_"),
  resendFromEmail: z.string().min(3),
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

/** Bootstrap or rotate Resend keys in platform_secrets. Authorized by Bearer resendApiKey. */
export async function POST(req: Request) {
  try {
    const auth = req.headers.get("authorization")?.trim() ?? "";
    const bearer = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : "";

    let body: z.infer<typeof bodySchema>;
    try {
      body = bodySchema.parse(await req.json());
    } catch {
      return NextResponse.json({ error: "Invalid Resend payload." }, { status: 400 });
    }

    if (!bearer || bearer !== body.resendApiKey) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    await upsertPlatformSecret("RESEND_API_KEY", body.resendApiKey);
    await upsertPlatformSecret("RESEND_FROM_EMAIL", body.resendFromEmail);
    clearPlatformSecretCache();

    return NextResponse.json({ ok: true, message: "Resend keys stored in platform_secrets." });
  } catch (e) {
    console.error("[bootstrap-platform-resend]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message.slice(0, 240) : "Bootstrap failed." },
      { status: 500 },
    );
  }
}
