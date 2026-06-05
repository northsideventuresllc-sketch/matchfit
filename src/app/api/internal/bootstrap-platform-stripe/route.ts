import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { clearPlatformSecretCache } from "@/lib/platform-secrets";
import { resetStripeClient } from "@/lib/stripe-server";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  stripeSecretKey: z.string().startsWith("sk_live_"),
  stripePublishableKey: z.string().startsWith("pk_live_"),
  stripeWebhookSecret: z.string().startsWith("whsec_"),
});

/**
 * One-time Stripe bootstrap into platform_secrets.
 * Authorized by Bearer token matching the webhook secret being stored.
 */
export async function POST(req: Request) {
  const auth = req.headers.get("authorization")?.trim() ?? "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : "";

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid Stripe key payload." }, { status: 400 });
  }

  if (!bearer || bearer !== body.stripeWebhookSecret) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const existing = await prisma.platformSecret.count({
    where: { key: { in: ["STRIPE_SECRET_KEY", "STRIPE_PUBLISHABLE_KEY", "STRIPE_WEBHOOK_SECRET"] } },
  });
  if (existing > 0) {
    return NextResponse.json(
      { error: "Stripe platform secrets already configured. Use Vercel env or admin API to rotate." },
      { status: 409 },
    );
  }

  const rows = [
    { key: "STRIPE_SECRET_KEY", value: body.stripeSecretKey },
    { key: "STRIPE_PUBLISHABLE_KEY", value: body.stripePublishableKey },
    { key: "STRIPE_WEBHOOK_SECRET", value: body.stripeWebhookSecret },
  ];

  for (const row of rows) {
    await prisma.platformSecret.create({ data: row });
  }

  clearPlatformSecretCache();
  resetStripeClient();

  return NextResponse.json({ ok: true, message: "Live Stripe keys bootstrapped into platform_secrets." });
}
