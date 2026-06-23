import { NextResponse } from "next/server";
import {
  INDEPENDENT_FP_DAILY_NUDGES,
  NUDGE_PACK_PURCHASE_NOTICE,
  trainerCanUseNudgeFeature,
  trainerCanUseInAppChat,
} from "@/lib/fp-tier-chat-policy";
import { evaluateTrainerNudgeQuota, FP_NUDGE_PACK_SIZE, utcDayRange } from "@/lib/trainer-nudge-limits";
import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const trainerId = await getSessionTrainerId();
  if (!trainerId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const profile = await prisma.trainerProfile.findUnique({
    where: { trainerId },
    select: {
      accountTier: true,
      nudgeCreditsBalance: true,
      premiumStudioEnabledAt: true,
    },
  });
  if (!profile) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }

  const { start, end } = utcDayRange();
  const nudgesUsedToday = await prisma.trainerClientNudge.count({
    where: { trainerId, createdAt: { gte: start, lt: end } },
  });
  const quota = evaluateTrainerNudgeQuota({
    accountTier: profile.accountTier,
    nudgesUsedToday,
    nudgeCreditsBalance: profile.nudgeCreditsBalance,
    legacyPremiumStudio: Boolean(profile.premiumStudioEnabledAt),
  });

  return NextResponse.json({
    accountTier: profile.accountTier,
    canUseNudges: trainerCanUseNudgeFeature(profile.accountTier),
    canUseInAppChat: trainerCanUseInAppChat(profile.accountTier),
    nudgesUsedToday,
    nudgesDailyLimit: quota.dailyLimit ?? INDEPENDENT_FP_DAILY_NUDGES,
    nudgeCreditsBalance: profile.nudgeCreditsBalance,
    nudgePackSize: FP_NUDGE_PACK_SIZE,
    nudgePackNotice: profile.accountTier === "independent_fitness_pro" ? NUDGE_PACK_PURCHASE_NOTICE : null,
    remainingFreeNudgesToday:
      quota.dailyLimit == null
        ? null
        : Math.max(0, (quota.dailyLimit ?? 0) - nudgesUsedToday),
  });
}
