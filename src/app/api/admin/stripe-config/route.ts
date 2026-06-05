import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/require-admin";
import { prisma } from "@/lib/prisma";
import { clearPlatformSecretCache } from "@/lib/platform-secrets";
import { resetStripeClient } from "@/lib/stripe-server";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  stripeSecretKey: z.string().startsWith("sk_live_"),
  stripePublishableKey: z.string().startsWith("pk_live_"),
  stripeWebhookSecret: z.string().startsWith("whsec_"),
});

/** One-time admin bootstrap for live Stripe keys into platform_secrets. */
export async function POST(req: Request) {
  const admin = await requireAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid Stripe key payload." }, { status: 400 });
  }

  const rows = [
    { key: "STRIPE_SECRET_KEY", value: body.stripeSecretKey },
    { key: "STRIPE_PUBLISHABLE_KEY", value: body.stripePublishableKey },
    { key: "STRIPE_WEBHOOK_SECRET", value: body.stripeWebhookSecret },
  ];

  for (const row of rows) {
    await prisma.platformSecret.upsert({
      where: { key: row.key },
      create: row,
      update: { value: row.value },
    });
  }

  clearPlatformSecretCache();
  resetStripeClient();

  return NextResponse.json({ ok: true, message: "Live Stripe keys stored in platform_secrets." });
}
