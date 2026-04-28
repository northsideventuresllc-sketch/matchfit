import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";
import { isTrainerPremiumStudioActive } from "@/lib/trainer-premium-studio";
import { trainerMatchAnswersToRegionZipPrefix } from "@/lib/featured-region";
import {
  entryTargetDisplayDayKey,
  easternDayStartUtcMs,
  getEasternDateKey,
} from "@/lib/featured-eastern-calendar";
import { sortBidsDesc, minBidCentsToPlaceInTopTwo, type BidRow } from "@/lib/featured-competition";
import { FEATURED_RULES_VERSION } from "@/lib/featured-rules-version";

export async function GET() {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const premium = await isTrainerPremiumStudioActive(trainerId);
    if (!premium) {
      return NextResponse.json({ error: "Premium Page is required for featured listing tools." }, { status: 403 });
    }

    const profile = await prisma.trainerProfile.findUnique({
      where: { trainerId },
      select: { matchQuestionnaireAnswers: true },
    });
    const regionZipPrefix = trainerMatchAnswersToRegionZipPrefix(profile?.matchQuestionnaireAnswers ?? null);

    const now = new Date();
    const entryDisplayDayKey = entryTargetDisplayDayKey(now);
    const cutoffMs = easternDayStartUtcMs(entryDisplayDayKey);

    if (!regionZipPrefix) {
      return NextResponse.json({
        eligible: false,
        reason: "IN_PERSON_ZIP_REQUIRED",
        message:
          "Regional featured placement uses the first three digits of your in-person ZIP from the Match questionnaire. Add in-person coverage with a valid US ZIP to join your local pool.",
        rulesVersion: FEATURED_RULES_VERSION,
      });
    }

    const [raffleEntry, bids, trainer] = await Promise.all([
      prisma.featuredRaffleEntry.findUnique({
        where: {
          trainerId_regionZipPrefix_displayDayKey: {
            trainerId,
            regionZipPrefix,
            displayDayKey: entryDisplayDayKey,
          },
        },
      }),
      prisma.featuredPlacementBid.findMany({
        where: { regionZipPrefix, displayDayKey: entryDisplayDayKey },
        select: { trainerId: true, amountCents: true, updatedAt: true, rulesAcceptedAt: true },
      }),
      prisma.trainer.findUnique({
        where: { id: trainerId },
        select: { id: true, safetySuspended: true },
      }),
    ]);

    if (!trainer || trainer.safetySuspended) {
      return NextResponse.json({ error: "Account unavailable." }, { status: 403 });
    }

    const bidRows: BidRow[] = bids.map((b) => ({
      trainerId: b.trainerId,
      amountCents: b.amountCents,
      updatedAt: b.updatedAt,
    }));
    const sorted = sortBidsDesc(bidRows);
    const myBid = bids.find((b) => b.trainerId === trainerId) ?? null;
    const minNext = minBidCentsToPlaceInTopTwo(bidRows, trainerId, now);

    return NextResponse.json({
      eligible: true,
      regionZipPrefix,
      entryDisplayDayKey,
      easternCutoffUtcMs: cutoffMs,
      easternTodayKey: getEasternDateKey(now),
      rulesVersion: FEATURED_RULES_VERSION,
      raffle: {
        entered: Boolean(raffleEntry),
        ticketWeight: raffleEntry?.ticketWeight ?? null,
        copy:
          "Each Premium coach who enters receives five tickets in the daily random draw. Winners are selected only from entrants in the same three-digit ZIP area. No purchase is required for the raffle beyond your Premium Page subscription.",
      },
      bids: {
        leaderboard: sorted.slice(0, 8).map((b) => ({
          trainerId: b.trainerId,
          amountCents: b.amountCents,
          isYou: b.trainerId === trainerId,
        })),
        myAmountCents: myBid?.amountCents ?? null,
        myRulesAcceptedAt: myBid?.rulesAcceptedAt?.toISOString() ?? null,
        minNextBidCents: minNext,
      },
    });
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Could not load featured listing.", {
      logLabel: "[trainer featured-listing GET]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
