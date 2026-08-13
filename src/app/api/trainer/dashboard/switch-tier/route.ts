import { NextResponse } from "next/server";
import { z } from "zod";
import { FP_ACCOUNT_TIERS, isFpAccountTier } from "@/lib/fp-account-tier-types";
import {
  buildFpTierSwitchProfileUpdate,
  countTrainerActiveSessions,
  evaluateFpTierSwitchEligibility,
  resolveFpTierSwitchBillingEffect,
  resolveListingStatusAfterTierSwitch,
} from "@/lib/fp-tier-switching";
import { fpTierSelectableDuringBeta } from "@/lib/fp-tier-beta-signup";
import type { FpDocSubmissionSummary } from "@/lib/fp-tier-docs";
import { createFpTierCheckoutSession } from "@/lib/fp-tier-subscription-checkout";
import { appBaseUrlForEmail } from "@/lib/match-fit-email-shell";
import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  targetTier: z.enum(FP_ACCOUNT_TIERS),
});

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

  const targetTier = parsed.data.targetTier;
  if (!fpTierSelectableDuringBeta(targetTier)) {
    return NextResponse.json(
      { error: "Match Fit Pro is not available during beta. Choose Match Fit Premium Pro or a paid account type." },
      { status: 400 },
    );
  }
  const now = new Date();

  const trainer = await prisma.trainer.findUnique({
    where: { id: trainerId },
    select: {
      email: true,
      profile: {
        select: {
          accountTier: true,
          tierSwitchedAt: true,
          tierSwitchCount: true,
          pendingTier: true,
          listingStatus: true,
          backgroundCheckPassed: true,
          billingCycleEnd: true,
          docsApproved: true,
          docsRejectionCount: true,
          docsLastRejectedAt: true,
          promoteTokensBalance: true,
        },
      },
    },
  });

  const prof = trainer?.profile;
  if (!prof) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }

  const activeSessions = await countTrainerActiveSessions(prisma, trainerId);
  const eligibility = evaluateFpTierSwitchEligibility(prof, targetTier, activeSessions, now);
  if (!eligibility.allowed) {
    const messages: Record<string, string> = {
      lock_active: "Account type switches are locked for 28 days after your last switch.",
      active_sessions: "Close all active sessions before switching your account type.",
      invalid_tier: "Invalid account type.",
      same_tier: "You are already on this account type.",
    };
    return NextResponse.json(
      {
        error: messages[eligibility.reason ?? ""] ?? "Switch not allowed.",
        reason: eligibility.reason,
        lockEndsAt: eligibility.lockEndsAt?.toISOString() ?? null,
        activeSessionCount: eligibility.activeSessionCount,
      },
      { status: 400 },
    );
  }

  const fromTier = isFpAccountTier(prof.accountTier) ? prof.accountTier : null;
  const billingEffect = resolveFpTierSwitchBillingEffect(fromTier, targetTier);

  // MF-TIER-SWITCH-NO-CHARGE fix: a switch that starts NEW paid billing (trainer has no active
  // FP subscription today) must actually charge through Stripe before anything changes -- it
  // can no longer just write pendingTier and call that "switched". Mirrors the trainer-signup
  // checkout pattern (src/app/api/trainer/signup/select-tier/route.ts): create a Checkout
  // Session, send the trainer to Stripe, and only promote accountTier once Stripe confirms the
  // subscription (activateFpTierSubscriptionFromWebhook in fp-tier-subscription-checkout.ts).
  // Paid-tier-to-paid-tier switches (independent_fitness_pro <-> elite_fitness_pro) are NOT
  // covered by this branch -- billingEffect.startsPaidBilling is false when fromTier is already
  // paid, so those still fall through to the immediate-write path below. Swapping the price on
  // an existing active subscription is a different Stripe call (subscription update + proration
  // policy) that was not part of the approved fix and still needs its own JB call; flagged
  // separately (NI-Brain, 2026-08-13) rather than guessed at here.
  if (billingEffect.startsPaidBilling) {
    const origin = appBaseUrlForEmail();
    const checkout = await createFpTierCheckoutSession(
      trainerId,
      trainer.email,
      targetTier,
      `${origin}/trainer/dashboard/account-tier?tierCheckout=success&tier=${targetTier}`,
      `${origin}/trainer/dashboard/account-tier?tierCheckout=cancel`,
      fromTier,
    );
    if ("error" in checkout) {
      return NextResponse.json({ error: checkout.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true, requiresCheckout: true, checkoutUrl: checkout.url });
  }

  const docs = await prisma.fpDocument.findMany({
    where: { trainerId },
    select: { docType: true, status: true, fileUrl: true },
  });

  const listingStatus = resolveListingStatusAfterTierSwitch(
    targetTier,
    prof,
    docs as FpDocSubmissionSummary[],
  );
  const profileUpdate = buildFpTierSwitchProfileUpdate(
    fromTier,
    targetTier,
    listingStatus,
    billingEffect,
    now,
  );

  await prisma.$transaction(async (tx) => {
    await tx.trainerProfile.update({
      where: { trainerId },
      data: profileUpdate,
    });
    await tx.tierSwitchHistory.create({
      data: {
        trainerId,
        fromTier: fromTier,
        toTier: targetTier,
        initiatedBy: "trainer",
      },
    });
  });

  return NextResponse.json({
    ok: true,
    listingStatus,
    pendingTier: profileUpdate.pendingTier ?? null,
    accountTier: profileUpdate.accountTier ?? prof.accountTier,
  });
}
