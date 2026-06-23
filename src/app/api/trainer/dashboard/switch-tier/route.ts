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
  const docs = await prisma.fpDocument.findMany({
    where: { trainerId },
    select: { docType: true, status: true, fileUrl: true },
  });

  const listingStatus = resolveListingStatusAfterTierSwitch(
    targetTier,
    prof,
    docs as FpDocSubmissionSummary[],
  );
  const billingEffect = resolveFpTierSwitchBillingEffect(fromTier, targetTier);
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
