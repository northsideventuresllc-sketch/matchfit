import { NextResponse } from "next/server";
import { z } from "zod";
import { getAppOriginFromRequest } from "@/lib/app-origin";
import {
  adminFeeCentsFromBaseSubtotalCents,
  ADMIN_FEE_STRIPE_DESCRIPTION,
  ADMIN_FEE_UI_LABEL,
} from "@/lib/platform-fees";
import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { getStripe } from "@/lib/stripe-server";
import { isTrainerPremiumStudioActive } from "@/lib/trainer-premium-studio";
import { getPromoPackTierById } from "@/lib/trainer-promo-tokens";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  packTier: z.enum(["starter", "growth", "scale"]),
});

export async function POST(req: Request) {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    if (!(await isTrainerPremiumStudioActive(trainerId))) {
      return NextResponse.json({ error: "Premium Page is required to buy tokens." }, { status: 403 });
    }
    const trainer = await prisma.trainer.findUnique({
      where: { id: trainerId },
      select: { safetySuspended: true, email: true },
    });
    if (!trainer || trainer.safetySuspended) {
      return NextResponse.json({ error: "Unavailable." }, { status: 403 });
    }
    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json({ error: "Billing is not configured." }, { status: 503 });
    }
    const json = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
    }
    const tier = getPromoPackTierById(parsed.data.packTier);
    if (!tier) {
      return NextResponse.json({ error: "Unknown pack." }, { status: 400 });
    }
    const origin = getAppOriginFromRequest(req);
    const baseCents = tier.usdCents;
    const adminCents = adminFeeCentsFromBaseSubtotalCents(baseCents);
    const totalCents = baseCents + adminCents;
    const usdBase = baseCents / 100;
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: trainer.email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: baseCents,
            product_data: {
              name: `Match Fit promotion tokens — ${tier.label} pack`,
              description: `${tier.tokens} tokens — pack subtotal $${usdBase.toFixed(2)} (before Match Fit administrative fee). Premium Page coaches only.`,
            },
          },
        },
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: adminCents,
            product_data: {
              name: ADMIN_FEE_UI_LABEL,
              description: ADMIN_FEE_STRIPE_DESCRIPTION,
            },
          },
        },
      ],
      metadata: {
        purpose: "trainer_promo_tokens",
        trainerId,
        packTier: tier.id,
        tokenAmount: String(tier.tokens),
        baseSubtotalCents: String(baseCents),
        adminFeeCents: String(adminCents),
        totalChargedCents: String(totalCents),
      },
      success_url: `${origin}/trainer/dashboard/premium/promo-tokens?checkout=success`,
      cancel_url: `${origin}/trainer/dashboard/premium/promo-tokens?checkout=cancel`,
    });
    if (!session.url) {
      return NextResponse.json({ error: "Could not start checkout." }, { status: 500 });
    }
    return NextResponse.json({
      url: session.url,
      tokens: tier.tokens,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not start checkout." }, { status: 500 });
  }
}
