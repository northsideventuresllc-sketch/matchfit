import { NextResponse } from "next/server";
import { trainerMatchAnswersToRegionZipPrefix } from "@/lib/featured-region";
import { prisma } from "@/lib/prisma";
import {
  MAX_CLIENT_GIFT_TO_TRAINER_PER_WEEK,
  MAX_PROMO_DURATION_DAYS,
  MAX_SINGLE_PROMOTION_TOKENS,
  MIN_PROMO_TOKENS_PER_DAY,
  TOKENS_PER_USD_PACK,
  USD_PACK_PRICE_CENTS,
  WEEKLY_PREMIUM_TRAINER_GRANT,
  backfillUngrantedSaleRewardsForTrainer,
  ensureWeeklyPremiumTrainerGrant,
  getTrainerTokenBalance,
} from "@/lib/trainer-promo-tokens";
import { isTrainerPremiumStudioActive } from "@/lib/trainer-premium-studio";
import { getSessionTrainerId } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const premium = await isTrainerPremiumStudioActive(trainerId);
    if (!premium) {
      return NextResponse.json({
        premium: false,
        message: "Promotion tokens are available to Premium Page coaches only.",
      });
    }
    const trainer = await prisma.trainer.findUnique({
      where: { id: trainerId },
      select: {
        safetySuspended: true,
        profile: { select: { matchQuestionnaireAnswers: true } },
      },
    });
    if (!trainer || trainer.safetySuspended) {
      return NextResponse.json({ error: "Unavailable." }, { status: 403 });
    }
    await ensureWeeklyPremiumTrainerGrant(trainerId);
    await backfillUngrantedSaleRewardsForTrainer(trainerId);
    const balance = await getTrainerTokenBalance(trainerId);
    const regionZipPrefix = trainerMatchAnswersToRegionZipPrefix(trainer.profile?.matchQuestionnaireAnswers ?? null);
    return NextResponse.json({
      premium: true,
      balance,
      regionZipPrefix,
      regionalBoostConfigured: Boolean(regionZipPrefix),
      economics: {
        tokensPerPack: TOKENS_PER_USD_PACK,
        packPriceUsd: USD_PACK_PRICE_CENTS / 100,
        weeklyGrant: WEEKLY_PREMIUM_TRAINER_GRANT,
        minTokensPerDay: MIN_PROMO_TOKENS_PER_DAY,
        maxPromotionDays: MAX_PROMO_DURATION_DAYS,
        maxSinglePromotionTokens: MAX_SINGLE_PROMOTION_TOKENS,
        clientGiftCapPerTrainerPerWeek: MAX_CLIENT_GIFT_TO_TRAINER_PER_WEEK,
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not load token summary." }, { status: 500 });
  }
}
