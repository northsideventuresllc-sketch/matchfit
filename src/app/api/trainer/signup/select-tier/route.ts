import { NextResponse } from "next/server";
import { z } from "zod";
import { FP_ACCOUNT_TIERS } from "@/lib/fp-account-tier-types";
import { fpTierRequiresBackgroundCheck } from "@/lib/fp-account-tier-types";
import { fpRequiredDocsForTier } from "@/lib/fp-tier-docs";
import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { resolveTrainerSignupNextPath } from "@/lib/trainer-signup-next-path";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  tier: z.enum(FP_ACCOUNT_TIERS),
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

  const tier = parsed.data.tier;
  const listingStatus = fpTierRequiresBackgroundCheck(tier) ? "pending_background" : "pending_docs";
  const requiredDocs = fpRequiredDocsForTier(tier);

  await prisma.$transaction(async (tx) => {
    await tx.trainerProfile.update({
      where: { trainerId },
      data: {
        accountTier: tier,
        listingStatus,
        docsSubmitted: requiredDocs.length === 0,
        docsApproved: false,
      },
    });
    await tx.fpListingStats.upsert({
      where: { trainerId },
      create: { trainerId, memberSince: new Date() },
      update: {},
    });
    await tx.tierSwitchHistory.create({
      data: {
        trainerId,
        fromTier: null,
        toTier: tier,
        initiatedBy: "trainer",
      },
    });
  });

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
