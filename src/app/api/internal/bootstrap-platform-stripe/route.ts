import { NextResponse } from "next/server";
import { z } from "zod";
import pg from "pg";
import { directPostgresUrlForDdl } from "@/lib/direct-postgres-ddl";
import { pgPoolConfigForConnectionString } from "@/lib/supabase-database-url";
import { clearPlatformSecretCache } from "@/lib/platform-secrets";
import { resetStripeClient } from "@/lib/stripe-server";

export const dynamic = "force-dynamic";

const PLATFORM_SECRETS_DDL = `
CREATE TABLE IF NOT EXISTS public.platform_secrets (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`;

const bodySchema = z.object({
  stripeSecretKey: z.string().startsWith("sk_live_"),
  stripePublishableKey: z.string().startsWith("pk_live_"),
  stripeWebhookSecret: z.string().startsWith("whsec_"),
});

async function upsertPlatformSecret(key: string, value: string): Promise<void> {
  const raw = directPostgresUrlForDdl();
  if (!raw) throw new Error("No direct Postgres URL available for platform_secrets bootstrap.");

  const pool = new pg.Pool({
    ...pgPoolConfigForConnectionString(raw),
    max: 1,
  });

  try {
    await pool.query(PLATFORM_SECRETS_DDL);
    await pool.query(
      `INSERT INTO public.platform_secrets (key, value, "updatedAt")
       VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO NOTHING`,
      [key, value],
    );
  } finally {
    await pool.end().catch(() => {});
  }
}

async function countPlatformStripeSecrets(): Promise<number> {
  const raw = directPostgresUrlForDdl();
  if (!raw) return 0;

  const pool = new pg.Pool({
    ...pgPoolConfigForConnectionString(raw),
    max: 1,
  });

  try {
    await pool.query(PLATFORM_SECRETS_DDL);
    const result = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM public.platform_secrets
       WHERE key IN ('STRIPE_SECRET_KEY', 'STRIPE_PUBLISHABLE_KEY', 'STRIPE_WEBHOOK_SECRET')`,
    );
    return Number(result.rows[0]?.count ?? 0);
  } finally {
    await pool.end().catch(() => {});
  }
}

/**
 * One-time Stripe bootstrap into platform_secrets.
 * Protect with `MATCHFIT_INTERNAL_TOOLS_SECRET` (see `.env.example`).
 */
export async function POST(req: Request) {
  try {
    const secret = process.env.MATCHFIT_INTERNAL_TOOLS_SECRET?.trim();
    if (!secret || secret.length < 16) {
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
      return NextResponse.json({ error: "Invalid Stripe key payload." }, { status: 400 });
    }

    const existing = await countPlatformStripeSecrets();
    if (existing > 0) {
      return NextResponse.json(
        { error: "Stripe platform secrets already configured. Use Vercel env or admin API to rotate." },
        { status: 409 },
      );
    }

    await upsertPlatformSecret("STRIPE_SECRET_KEY", body.stripeSecretKey);
    await upsertPlatformSecret("STRIPE_PUBLISHABLE_KEY", body.stripePublishableKey);
    await upsertPlatformSecret("STRIPE_WEBHOOK_SECRET", body.stripeWebhookSecret);

    clearPlatformSecretCache();
    resetStripeClient();

    return NextResponse.json({ ok: true, message: "Live Stripe keys bootstrapped into platform_secrets." });
  } catch (e) {
    console.error("[bootstrap-platform-stripe]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message.slice(0, 240) : "Bootstrap failed." },
      { status: 500 },
    );
  }
}
