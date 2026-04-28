import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";
import { isTrainerPremiumStudioActive } from "@/lib/trainer-premium-studio";
import { trainerMatchAnswersToRegionZipPrefix } from "@/lib/featured-region";
import { entryTargetDisplayDayKey, easternDayStartUtcMs } from "@/lib/featured-eastern-calendar";
import { FEATURED_TICKETS_PER_ENTRANT } from "@/lib/featured-competition";
import { FEATURED_RULES_VERSION } from "@/lib/featured-rules-version";

const bodySchema = z.object({
  acceptOfficialRules: z.literal(true),
  rulesVersion: z.string().refine((v) => v === FEATURED_RULES_VERSION, "Refresh to load the latest rules version."),
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
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Confirm the official rules to enter the raffle." }, { status: 400 });
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
            "You need an in-person US ZIP on your Match questionnaire before you can join a regional featured raffle.",
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
      return NextResponse.json({ error: "Entries for this display day are closed. Refresh for the next window." }, { status: 400 });
    }

    await prisma.featuredRaffleEntry.upsert({
      where: {
        trainerId_regionZipPrefix_displayDayKey: {
          trainerId,
          regionZipPrefix,
          displayDayKey,
        },
      },
      create: {
        trainerId,
        regionZipPrefix,
        displayDayKey,
        ticketWeight: FEATURED_TICKETS_PER_ENTRANT,
      },
      update: {
        ticketWeight: FEATURED_TICKETS_PER_ENTRANT,
      },
    });

    return NextResponse.json({ ok: true, displayDayKey, regionZipPrefix });
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Could not save raffle entry.", {
      logLabel: "[trainer featured-listing raffle POST]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
