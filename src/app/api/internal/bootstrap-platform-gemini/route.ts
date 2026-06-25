import { NextResponse } from "next/server";
import { z } from "zod";
import pg from "pg";
import { directPostgresUrlForDdl } from "@/lib/direct-postgres-ddl";
import { pgPoolConfigForConnectionString } from "@/lib/supabase-database-url";
import { clearPlatformSecretCache } from "@/lib/platform-secrets";
import { resetHydratePlatformEnvCache } from "@/lib/hydrate-platform-env";
import { isValidGeminiApiKey } from "@/lib/google-gemini-ai";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  geminiApiKey: z.string().min(20),
  geminiBackupApiKey: z.string().min(20).optional(),
  geminiModel: z.string().min(1).optional(),
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

/** Bootstrap or rotate Gemini fallback key in platform_secrets. Authorized by Bearer geminiApiKey. */
export async function POST(req: Request) {
  try {
    const auth = req.headers.get("authorization")?.trim() ?? "";
    const bearer = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : "";

    let body: z.infer<typeof bodySchema>;
    try {
      body = bodySchema.parse(await req.json());
    } catch {
      return NextResponse.json({ error: "Invalid Gemini payload." }, { status: 400 });
    }

    if (!isValidGeminiApiKey(body.geminiApiKey)) {
      return NextResponse.json({ error: "Gemini API key format is invalid." }, { status: 400 });
    }

    if (!bearer || bearer !== body.geminiApiKey) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    await upsertPlatformSecret("GEMINI_API_KEY", body.geminiApiKey);
    if (body.geminiBackupApiKey) {
      await upsertPlatformSecret("GEMINI_API_KEY_BACKUP", body.geminiBackupApiKey);
    }
    await upsertPlatformSecret("GEMINI_MODEL", body.geminiModel?.trim() || "gemini-2.0-flash");
    clearPlatformSecretCache();
    resetHydratePlatformEnvCache();

    return NextResponse.json({ ok: true, message: "Gemini API key stored in platform_secrets." });
  } catch (e) {
    console.error("[bootstrap-platform-gemini]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message.slice(0, 240) : "Bootstrap failed." },
      { status: 500 },
    );
  }
}
