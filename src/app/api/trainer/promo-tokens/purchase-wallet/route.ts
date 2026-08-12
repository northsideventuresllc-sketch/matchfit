import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { isTrainerPremiumStudioActive } from "@/lib/trainer-premium-studio";
import { getPromoPackTierById, creditTokensFromStripePurchase } from "@/lib/trainer-promo-tokens";
import { debitTrainerWalletForPurchase } from "@/lib/trainer-wallet-purchase";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  packTier: z.enum(["starter", "growth", "scale"]),
});

/** Same promo token packs as purchase-checkout, paid from the earnings wallet instead of Stripe. */
export async function POST(req: Request) {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    if (!(await isTrainerPremiumStudioActive(trainerId))) {
      return NextResponse.json({ error: "Premium Page is required to buy tokens." }, { status: 403 });
    }

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
    }
    const tier = getPromoPackTierById(parsed.data.packTier);
    if (!tier) {
      return NextResponse.json({ error: "Unknown pack." }, { status: 400 });
    }

    const trainer = await prisma.trainer.findUnique({
      where: { id: trainerId },
      select: { safetySuspended: true },
    });
    if (!trainer || trainer.safetySuspended) {
      return NextResponse.json({ error: "Unavailable." }, { status: 403 });
    }

    const debit = await debitTrainerWalletForPurchase({
      trainerId,
      amountCents: tier.usdCents,
      metaJson: JSON.stringify({ purpose: "trainer_promo_tokens", packTier: tier.id }),
    });
    if (!debit.ok) {
      return NextResponse.json({ error: debit.error }, { status: 400 });
    }

    const ref = `wallet_promo_${tier.id}_${trainerId}_${Date.now()}`;
    const credited = await creditTokensFromStripePurchase(trainerId, ref, tier.tokens);
    if ("skipped" in credited) {
      return NextResponse.json({ error: "Already credited for this request." }, { status: 409 });
    }

    return NextResponse.json({ ok: true, tokens: tier.tokens });
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Could not complete wallet purchase.", {
      logLabel: "[trainer promo-tokens purchase-wallet]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
