import { parseClientMatchPreferencesJson } from "@/lib/client-match-preferences";
import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { isTrainerComplianceComplete } from "@/lib/trainer-compliance-complete";
import {
  clientMatchesTrainerDiscoveryStrictness,
  parseTrainerDiscoveryStrictness,
} from "@/lib/trainer-discovery-strictness";
import { scoreClientForTrainerIdeal } from "@/lib/trainer-client-fit-score";
import { isTrainerClientPairBlocked } from "@/lib/user-block-queries";
import { NextResponse } from "next/server";

function displayClientName(c: { preferredName: string; firstName: string; lastName: string }): string {
  return c.preferredName?.trim() || [c.firstName, c.lastName].filter(Boolean).join(" ").trim() || "Client";
}

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
            onboardingTrackCpt: true,
            onboardingTrackNutrition: true,
            certificationReviewStatus: true,
            nutritionistCertificationReviewStatus: true,
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
        { error: "Finish your Match Me questionnaire so we know your ideal client profile." },
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

    const clients = await prisma.client.findMany({
      where: {
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

    const rows: Array<{
      username: string;
      displayName: string;
      zipCode: string;
      bio: string | null;
      profileImageUrl: string | null;
      score: number;
      nicheHits: number;
      serviceOk: boolean;
      deliveryOk: boolean;
    }> = [];

    for (const c of clients) {
      if (await isTrainerClientPairBlocked(trainer.id, c.id)) continue;
      const prefs = parseClientMatchPreferencesJson(c.matchPreferencesJson);
      const m = scoreClientForTrainerIdeal(ideal, prefs);
      if (!clientMatchesTrainerDiscoveryStrictness(strictness, prefs, m)) continue;
      rows.push({
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

    rows.sort((a, b) => b.score - a.score);

    return NextResponse.json({
      strictness,
      clients: rows.slice(0, 48),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not load clients." }, { status: 500 });
  }
}
