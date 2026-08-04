import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * "No thanks" at the end of the Premium Pro trial.
 *
 * Moves the account to Match Fit Pro and keeps it working, rather than letting the trial lapse
 * into payment grace and deactivation. Only ever downgrades, and only the caller's own account.
 */
export async function POST() {
  const trainerId = await getSessionTrainerId();
  if (!trainerId) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const profile = await prisma.trainerProfile.findUnique({
    where: { trainerId },
    select: { accountTier: true },
  });
  if (!profile) {
    return NextResponse.json({ error: "We could not find your account." }, { status: 404 });
  }
  if (profile.accountTier !== "match_fit_premium_pro") {
    // Nothing to decline — treat as already settled rather than an error.
    return NextResponse.json({ ok: true, tier: profile.accountTier });
  }

  await prisma.$transaction(async (tx) => {
    await tx.trainerProfile.update({
      where: { trainerId },
      data: { accountTier: "match_fit_pro" },
    });
    await tx.tierSwitchHistory.create({
      data: {
        trainerId,
        fromTier: "match_fit_premium_pro",
        toTier: "match_fit_pro",
        initiatedBy: "trainer",
      },
    });
  });

  // The trial no longer has anything to expire into, so stop the billing lifecycle from
  // pushing this account towards payment grace and deactivation.
  await prisma.trainer.update({
    where: { id: trainerId },
    data: { platformTrialEndsAt: null, paymentGraceUntil: null, platformTrialConsumed: true },
  });

  return NextResponse.json({ ok: true, tier: "match_fit_pro" });
}
