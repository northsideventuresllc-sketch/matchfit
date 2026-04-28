import {
  parseClientMatchPreferencesJson,
  scoreTrainerForClientPrefs,
  trainerPassesStrictBrowse,
} from "@/lib/client-match-preferences";
import { isTrainerComplianceComplete } from "@/lib/trainer-compliance-complete";
import { prisma } from "@/lib/prisma";
import { getSessionClientId } from "@/lib/session";
import { NextResponse } from "next/server";

function coachDisplayName(trainer: {
  preferredName: string | null;
  firstName: string;
  lastName: string;
}): string {
  return (
    trainer.preferredName?.trim() ||
    [trainer.firstName, trainer.lastName].filter(Boolean).join(" ").trim() ||
    "Coach"
  );
}

export async function GET(req: Request) {
  try {
    const clientId = await getSessionClientId();
    if (!clientId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { matchPreferencesJson: true, matchPreferencesCompletedAt: true },
    });
    if (!client) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const url = new URL(req.url);
    const relaxed = url.searchParams.get("relaxed") === "1" || url.searchParams.get("relaxed") === "true";

    const prefs = parseClientMatchPreferencesJson(client.matchPreferencesJson);

    const trainers = await prisma.trainer.findMany({
      where: {
        profile: {
          dashboardActivatedAt: { not: null },
        },
      },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        preferredName: true,
        bio: true,
        profileImageUrl: true,
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
          },
        },
      },
    });

    const published = trainers.filter(
      (t) => t.profile && t.profile.dashboardActivatedAt != null && isTrainerComplianceComplete(t.profile),
    );

    const scored = published.map((t) => {
      const profile = t.profile!;
      const metrics = scoreTrainerForClientPrefs(prefs, {
        fitnessNiches: t.fitnessNiches,
        aiMatchProfileText: profile.aiMatchProfileText,
        profile: {
          onboardingTrackCpt: profile.onboardingTrackCpt,
          onboardingTrackNutrition: profile.onboardingTrackNutrition,
        },
      });
      return {
        id: t.id,
        username: t.username,
        displayName: coachDisplayName(t),
        bio: t.bio,
        profileImageUrl: t.profileImageUrl,
        fitnessNiches: t.fitnessNiches,
        score: metrics.score,
        match: {
          nicheHits: metrics.nicheHits,
          serviceOk: metrics.serviceOk,
          deliveryOk: metrics.deliveryOk,
          strictPass: trainerPassesStrictBrowse(prefs, metrics),
        },
      };
    });

    const filtered = relaxed ? scored : scored.filter((r) => r.match.strictPass);
    const list = (filtered.length ? filtered : scored).sort((a, b) => b.score - a.score);

    return NextResponse.json({
      trainers: list,
      relaxed: relaxed || (filtered.length === 0 && scored.length > 0),
      preferencesComplete: Boolean(client.matchPreferencesCompletedAt),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not load trainers." }, { status: 500 });
  }
}
