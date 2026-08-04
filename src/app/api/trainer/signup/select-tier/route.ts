import { NextResponse } from "next/server";
import { z } from "zod";
import {
  FP_ACCOUNT_TIERS,
  FP_TIER_DISPLAY_NAMES,
  fpTierRequiresBackgroundCheck,
  fpTierRequiresMonthlyFee,
} from "@/lib/fp-account-tier-types";
import {
  fpBetaPremiumPromoEndsAt,
  fpBetaSignupActive,
  fpTierSelectableDuringBeta,
  resolveFpTierSignupOutcome,
} from "@/lib/fp-tier-beta-signup";
import { fpStripePriceEnvKeyForTier } from "@/lib/fp-tier-billing";
import { getTrainerBetaDiscountedMax } from "@/lib/match-fit-launch-promotion-caps";
import { countLaunchTrainers } from "@/lib/launch-account-counts";
import { fpRequiredDocsForTier } from "@/lib/fp-tier-docs";
import { createFpTierCheckoutSession } from "@/lib/fp-tier-subscription-checkout";
import { prisma } from "@/lib/prisma";
import { appBaseUrlForEmail } from "@/lib/match-fit-email-shell";
import { getSessionTrainerId } from "@/lib/session";
import { resolveTrainerSignupNextPath } from "@/lib/trainer-signup-next-path";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  tier: z.enum(FP_ACCOUNT_TIERS),
});

async function persistTierSelection(trainerId: string, tier: (typeof FP_ACCOUNT_TIERS)[number]) {
  const listingStatus = fpTierRequiresBackgroundCheck(tier) ? "pending_background" : "pending_docs";
  const requiredDocs = fpRequiredDocsForTier(tier);
  const promoEndsAt = fpBetaSignupActive() && tier === "match_fit_premium_pro" ? fpBetaPremiumPromoEndsAt() : null;

  await prisma.$transaction(async (tx) => {
    await tx.trainerProfile.update({
      where: { trainerId },
      data: {
        accountTier: tier,
        listingStatus,
        docsSubmitted: requiredDocs.length === 0,
        docsApproved: false,
        ...(promoEndsAt ? { billingCycleEnd: promoEndsAt } : {}),
      },
    });
    await tx.fpListingStats.upsert({
      where: { trainerId },
      create: { trainerId, memberSince: new Date() },
      update: {},
    });
    const existingHistory = await tx.tierSwitchHistory.findFirst({
      where: { trainerId, fromTier: null },
      select: { id: true },
    });
    if (!existingHistory) {
      await tx.tierSwitchHistory.create({
        data: {
          trainerId,
          fromTier: null,
          toTier: tier,
          initiatedBy: "trainer",
        },
      });
    }
  });
}

export async function POST(req: Request) {
  const trainerId = await getSessionTrainerId();
  if (!trainerId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Select a valid account type." }, { status: 400 });
  }

  // The founding cohort goes straight to the dashboard on every account type — no card, no
  // Stripe redirect — and anyone asking for Match Fit Pro during beta is upgraded to Premium
  // Pro. After the cohort fills, the tiers with a monthly fee take payment here instead.
  const outcome = resolveFpTierSignupOutcome({
    requested: parsed.data.tier,
    existingTrainerCount: await countLaunchTrainers(),
    foundingCohortMax: getTrainerBetaDiscountedMax(),
    tierHasConfiguredPrice: (t) => {
      const envKey = fpStripePriceEnvKeyForTier(t);
      return Boolean(envKey && process.env[envKey]?.trim());
    },
  });
  const tier = outcome.tier;

  // Outside the founding cohort a fee-bearing tier must actually be able to take payment.
  // Without this it would be granted for free because there was nothing to charge against.
  if (!outcome.foundingCohort && fpTierRequiresMonthlyFee(tier) && !outcome.requiresCheckoutNow) {
    return NextResponse.json(
      {
        error: `${FP_TIER_DISPLAY_NAMES[tier]} cannot be set up right now. Choose another account type, or try again shortly.`,
        code: "TIER_UNAVAILABLE",
      },
      { status: 503 },
    );
  }

  if (!fpTierSelectableDuringBeta(tier)) {
    return NextResponse.json(
      { error: "Match Fit Pro is not available during beta. Choose Match Fit Premium Pro or a paid account type." },
      { status: 400 },
    );
  }

  const trainer = await prisma.trainer.findUnique({
    where: { id: trainerId },
    select: { email: true, stripeSubscriptionActive: true },
  });
  if (!trainer) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }

  if (outcome.requiresCheckoutNow && !trainer.stripeSubscriptionActive) {
    const origin = appBaseUrlForEmail();
    const checkout = await createFpTierCheckoutSession(
      trainerId,
      trainer.email,
      tier,
      `${origin}/trainer/signup/tier?checkout=success&tier=${tier}`,
      `${origin}/trainer/signup/tier?checkout=cancel`,
    );
    if ("error" in checkout) {
      return NextResponse.json({ error: checkout.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true, requiresCheckout: true, checkoutUrl: checkout.url });
  }

  await persistTierSelection(trainerId, tier);

  const profile = await prisma.trainerProfile.findUnique({
    where: { trainerId },
    select: {
      hasSignedTOS: true,
      accountTier: true,
      docsSubmitted: true,
      docsApproved: true,
      registrationFeeHoldStatus: true,
      hasPaidRegistrationFee: true,
      limitedDashboardUnlockedAt: true,
      onboardingFeePaymentDeadlineAt: true,
      onboardingFeePaymentExpiredAt: true,
    },
  });

  return NextResponse.json({ ok: true, next: resolveTrainerSignupNextPath(profile) });
}
