import { NextResponse } from "next/server";
import { z } from "zod";
import { getAppOriginFromRequest } from "@/lib/app-origin";
import { buildMarketplaceCheckoutTotals, stripeLineItemsFromMarketplaceTotals } from "@/lib/platform-fees";
import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { getStripe } from "@/lib/stripe-server";
import { isTrainerPremiumStudioActive } from "@/lib/trainer-premium-studio";
import { getPromoPackTierById, creditTokensFromStripePurchase } from "@/lib/trainer-promo-tokens";
import { verifyMatchFitInternalQaTrainerOnboardingBypass } from "@/lib/match-fit-internal-qa";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  packTier: z.enum(["starter", "growth", "scale"]),
  internalQaPassword: z.string().optional(),
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

    const json = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
    }
    const tier = getPromoPackTierById(parsed.data.packTier);
    if (!tier) {
      return NextResponse.json({ error: "Unknown pack." }, { status: 400 });
    }

    const trainer = await prisma.trainer.findUnique({
      where: { id: trainerId },
      select: { safetySuspended: true, email: true, passwordHash: true },
    });
    if (!trainer || trainer.safetySuspended) {
      return NextResponse.json({ error: "Unavailable." }, { status: 403 });
    }

    const qaPw = parsed.data.internalQaPassword?.trim();
    if (
      qaPw &&
      (await verifyMatchFitInternalQaTrainerOnboardingBypass({
        trainerEmail: trainer.email,
        trainerPasswordHash: trainer.passwordHash,
        inputPassword: qaPw,
      }))
    ) {
      const ref = `internal_qa_promo_${tier.id}_${trainerId}_${Date.now()}`;
      const credited = await creditTokensFromStripePurchase(trainerId, ref, tier.tokens);
      if ("skipped" in credited) {
        return NextResponse.json({ error: "Already credited for this request." }, { status: 409 });
      }
      return NextResponse.json({ ok: true, tokens: tier.tokens, credited: credited.credited });
    }

    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json({ error: "Billing is not configured." }, { status: 503 });
    }

    const origin = getAppOriginFromRequest(req);
    const baseCents = tier.usdCents;
    const totals = buildMarketplaceCheckoutTotals(baseCents, { includeAdminFee: true });
    const usdBase = baseCents / 100;
    const line_items = stripeLineItemsFromMarketplaceTotals({
      totals,
      includeAdminFee: true,
      baseLine: {
        name: `Match Fit promotion tokens — ${tier.label} pack`,
        description: `${tier.tokens} tokens — pack subtotal $${usdBase.toFixed(2)} (before fees). Premium Page coaches only.`,
      },
    });
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: trainer.email,
      line_items,
      metadata: {
        purpose: "trainer_promo_tokens",
        trainerId,
        packTier: tier.id,
        tokenAmount: String(tier.tokens),
        baseSubtotalCents: String(baseCents),
        adminFeeCents: String(totals.adminCents),
        processingFeeCents: String(totals.processingCents),
        totalChargedCents: String(totals.totalCents),
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
