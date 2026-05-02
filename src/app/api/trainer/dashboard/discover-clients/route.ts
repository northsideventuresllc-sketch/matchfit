import { parseClientMatchPreferencesJson } from "@/lib/client-match-preferences";
import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { isTrainerComplianceComplete } from "@/lib/trainer-compliance-complete";
import {
  clientMatchesTrainerDiscoveryStrictness,
  parseTrainerDiscoveryStrictness,
} from "@/lib/trainer-discovery-strictness";
import { scoreClientForTrainerIdeal } from "@/lib/trainer-client-fit-score";
import { isBrowsePassCooldownActive } from "@/lib/client-trainer-browse";
import {
  currentTrainerDiscoverBucket,
  STANDARD_MATCH_BATCH_SIZE,
} from "@/lib/trainer-discover-match-batch";
import { isTrainerPremiumStudioActive } from "@/lib/trainer-premium-studio";
import { isClientHiddenFromTrainerDiscover } from "@/lib/user-block-queries";
import { assertTrainerClientPayloadHasNoAddress } from "@/lib/trainer-safe-client-profile";
import { NextResponse } from "next/server";

function displayClientName(c: { preferredName: string; firstName: string; lastName: string }): string {
  return c.preferredName?.trim() || [c.firstName, c.lastName].filter(Boolean).join(" ").trim() || "Client";
}

type InternalRow = {
  id: string;
  username: string;
  displayName: string;
  zipCode: string;
  bio: string | null;
  profileImageUrl: string | null;
  score: number;
  nicheHits: number;
  serviceOk: boolean;
  deliveryOk: boolean;
};

export async function GET(req: Request) {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const url = new URL(req.url);
    const strictness = parseTrainerDiscoveryStrictness(url.searchParams.get("strictness"));
    const q = url.searchParams.get("q")?.trim().toLowerCase() ?? "";

    const trainer = await prisma.trainer.findUnique({
      where: { id: trainerId },
      select: {
        id: true,
        fitnessNiches: true,
        profile: {
          select: {
            dashboardActivatedAt: true,
            hasSignedTOS: true,
            hasUploadedW9: true,
            backgroundCheckStatus: true,
            backgroundCheckClearedAt: true,
            onboardingTrackCpt: true,
            onboardingTrackNutrition: true,
            onboardingTrackSpecialist: true,
            certificationReviewStatus: true,
            nutritionistCertificationReviewStatus: true,
            specialistCertificationReviewStatus: true,
            aiMatchProfileText: true,
            matchQuestionnaireStatus: true,
          },
        },
      },
    });
    if (!trainer?.profile || trainer.profile.dashboardActivatedAt == null || !isTrainerComplianceComplete(trainer.profile)) {
      return NextResponse.json({ error: "Your trainer profile must be live before you can browse clients." }, { status: 403 });
    }
    if (trainer.profile.matchQuestionnaireStatus !== "completed" || !trainer.profile.aiMatchProfileText?.trim()) {
      return NextResponse.json(
        { error: "Finish your Onboarding Questionnaire so we know your ideal client profile." },
        { status: 403 },
      );
    }

    const ideal: Parameters<typeof scoreClientForTrainerIdeal>[0] = {
      fitnessNiches: trainer.fitnessNiches,
      aiMatchProfileText: trainer.profile.aiMatchProfileText,
      profile: {
        onboardingTrackCpt: trainer.profile.onboardingTrackCpt,
        onboardingTrackNutrition: trainer.profile.onboardingTrackNutrition,
        certificationReviewStatus: trainer.profile.certificationReviewStatus,
        nutritionistCertificationReviewStatus: trainer.profile.nutritionistCertificationReviewStatus,
      },
    };

    const matchedConvs = await prisma.trainerClientConversation.findMany({
      where: { trainerId, officialChatStartedAt: { not: null } },
      select: { clientId: true },
    });
    const matchedClientIds = new Set(matchedConvs.map((c) => c.clientId));

    const trainerBrowsePasses = await prisma.trainerClientBrowsePass.findMany({
      where: { trainerId },
      select: { clientId: true, createdAt: true, lastPassedAt: true },
    });
    const trainerPassByClientId = new Map(trainerBrowsePasses.map((p) => [p.clientId, p]));

    const clients = await prisma.client.findMany({
      where: {
        deidentifiedAt: null,
        allowTrainerDiscovery: true,
        matchPreferencesCompletedAt: { not: null },
        ...(q
          ? {
              OR: [
                { username: { contains: q } },
                { preferredName: { contains: q } },
                { firstName: { contains: q } },
                { lastName: { contains: q } },
              ],
            }
          : {}),
      },
      take: 80,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        username: true,
        preferredName: true,
        firstName: true,
        lastName: true,
        zipCode: true,
        bio: true,
        profileImageUrl: true,
        matchPreferencesJson: true,
      },
    });

    const internal: InternalRow[] = [];

    for (const c of clients) {
      if (matchedClientIds.has(c.id)) continue;
      const tp = trainerPassByClientId.get(c.id);
      if (tp && isBrowsePassCooldownActive(tp.lastPassedAt, tp.createdAt)) continue;
      if (await isClientHiddenFromTrainerDiscover(trainer.id, c.id)) continue;
      const prefs = parseClientMatchPreferencesJson(c.matchPreferencesJson);
      const m = scoreClientForTrainerIdeal(ideal, prefs);
      if (!clientMatchesTrainerDiscoveryStrictness(strictness, prefs, m)) continue;
      internal.push({
        id: c.id,
        username: c.username,
        displayName: displayClientName(c),
        zipCode: c.zipCode,
        bio: c.bio,
        profileImageUrl: c.profileImageUrl,
        score: m.score,
        nicheHits: m.nicheHits,
        serviceOk: m.serviceOk,
        deliveryOk: m.deliveryOk,
      });
    }

    internal.sort((a, b) => b.score - a.score);

    const isPremium = await isTrainerPremiumStudioActive(trainerId);
    let served = internal;

    if (!isPremium) {
      const bucket = currentTrainerDiscoverBucket();
      const existing = await prisma.trainerDiscoverMatchBatch.findUnique({
        where: { trainerId_bucket: { trainerId, bucket } },
      });
      if (!existing) {
        const pick = internal.slice(0, STANDARD_MATCH_BATCH_SIZE);
        if (pick.length > 0) {
          await prisma.trainerDiscoverMatchBatch.create({
            data: {
              trainerId,
              bucket,
              clientIdsJson: JSON.stringify(pick.map((r) => r.id)),
            },
          });
        }
        served = pick;
      } else {
        let ids: string[] = [];
        try {
          ids = JSON.parse(existing.clientIdsJson) as string[];
        } catch {
          ids = [];
        }
        const idSet = new Set(ids);
        served = internal.filter((r) => idSet.has(r.id));
      }
    } else {
      served = internal.slice(0, 48);
    }

    const clientsOut = served.map(({ id: _omit, ...rest }) => rest);
    if (process.env.NODE_ENV !== "production") {
      for (const row of clientsOut) {
        assertTrainerClientPayloadHasNoAddress(row, "discover-clients");
      }
    }

    return NextResponse.json({
      strictness,
      matchBatch: {
        premiumUnlimited: isPremium,
        standardBatchSize: STANDARD_MATCH_BATCH_SIZE,
        standardWindowHours: 12,
      },
      clients: clientsOut,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not load clients." }, { status: 500 });
  }
}
