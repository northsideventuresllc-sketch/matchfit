import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";
import { isTrainerPremiumStudioActive } from "@/lib/trainer-premium-studio";
import { trainerMatchAnswersToRegionZipPrefix } from "@/lib/featured-region";
import { entryTargetDisplayDayKey, easternDayStartUtcMs } from "@/lib/featured-eastern-calendar";
import { minBidCentsToPlaceInTopTwo, type BidRow } from "@/lib/featured-competition";
import { FEATURED_RULES_VERSION } from "@/lib/featured-rules-version";

const bidSchema = z.object({
  amountCents: z.number().int().min(500).max(10_000_000),
  rulesVersion: z.string(),
  acceptSponsoredPlacementTerms: z.literal(true),
  acceptNonRefundableCharges: z.literal(true),
});

export async function POST(req: Request) {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const premium = await isTrainerPremiumStudioActive(trainerId);
    if (!premium) {
      return NextResponse.json({ error: "Premium Page is required." }, { status: 403 });
    }

    const json = await req.json().catch(() => null);
    const parsed = bidSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid bid payload." }, { status: 400 });
    }
    const payload = parsed.data;
    if (payload.rulesVersion !== FEATURED_RULES_VERSION) {
      return NextResponse.json({ error: "Refresh the page to accept the current rules version." }, { status: 400 });
    }

    const profile = await prisma.trainerProfile.findUnique({
      where: { trainerId },
      select: { matchQuestionnaireAnswers: true },
    });
    const regionZipPrefix = trainerMatchAnswersToRegionZipPrefix(profile?.matchQuestionnaireAnswers ?? null);
    if (!regionZipPrefix) {
      return NextResponse.json(
        {
          error:
            "You need an in-person US ZIP in your Onboarding Questionnaire before you can bid in a regional auction.",
        },
        { status: 400 },
      );
    }

    const trainer = await prisma.trainer.findUnique({
      where: { id: trainerId },
      select: { safetySuspended: true },
    });
    if (!trainer || trainer.safetySuspended) {
      return NextResponse.json({ error: "Account unavailable." }, { status: 403 });
    }

    const now = new Date();
    const displayDayKey = entryTargetDisplayDayKey(now);
    if (Date.now() >= easternDayStartUtcMs(displayDayKey)) {
      return NextResponse.json({ error: "Bidding for this display day is closed. Refresh for the next window." }, { status: 400 });
    }

    const allBids = await prisma.featuredPlacementBid.findMany({
      where: { regionZipPrefix, displayDayKey },
      select: { trainerId: true, amountCents: true, updatedAt: true },
    });
    const rows: BidRow[] = allBids.map((b) => ({
      trainerId: b.trainerId,
      amountCents: b.amountCents,
      updatedAt: b.updatedAt,
    }));

    const minRequired = minBidCentsToPlaceInTopTwo(rows, trainerId, now);
    if (payload.amountCents < minRequired) {
      return NextResponse.json(
        { error: `Bid must be at least $${(minRequired / 100).toFixed(2)} for this window.` },
        { status: 400 },
      );
    }

    const existing = await prisma.featuredPlacementBid.findUnique({
      where: {
        trainerId_regionZipPrefix_displayDayKey: {
          trainerId,
          regionZipPrefix,
          displayDayKey,
        },
      },
    });

    if (existing && payload.amountCents <= existing.amountCents) {
      return NextResponse.json({ error: "New bid must be higher than your current amount." }, { status: 400 });
    }

    /**
     * Paid bids: trainer billing is not fully wired to Stripe yet. Amounts are recorded as binding
     * obligations; card capture will align with coach billing when available. Do not imply funds moved.
     */
    const paidCents = payload.amountCents;

    if (existing) {
      await prisma.featuredPlacementBid.update({
        where: { id: existing.id },
        data: {
          amountCents: payload.amountCents,
          paidCents,
          rulesAcceptedAt: existing.rulesAcceptedAt ?? now,
          rulesVersion: FEATURED_RULES_VERSION,
        },
      });
    } else {
      await prisma.featuredPlacementBid.create({
        data: {
          trainerId,
          regionZipPrefix,
          displayDayKey,
          amountCents: payload.amountCents,
          paidCents,
          rulesAcceptedAt: now,
          rulesVersion: FEATURED_RULES_VERSION,
        },
      });
    }

    return NextResponse.json({ ok: true, displayDayKey, regionZipPrefix, amountCents: payload.amountCents });
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Could not save bid.", {
      logLabel: "[trainer featured-listing bid POST]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
