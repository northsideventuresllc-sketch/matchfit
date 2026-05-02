import {
  parseClientMatchPreferencesJson,
  scoreTrainerForClientPrefs,
  trainerPassesStrictBrowse,
} from "@/lib/client-match-preferences";
import {
  CLIENT_TRAINER_NOT_INTERESTED_UI_HISTORY_DAYS,
  CLIENT_TRAINER_PASS_COOLDOWN_DAYS,
  effectiveBrowsePassAt,
  isBrowsePassCooldownActive,
  isWithinNotInterestedHistoryWindow,
} from "@/lib/client-trainer-browse";
import { isTrainerComplianceComplete } from "@/lib/trainer-compliance-complete";
import { prisma } from "@/lib/prisma";
import { getSessionClientId } from "@/lib/session";
import { getTrainerIdsHiddenFromClientMatchFeed } from "@/lib/user-block-queries";
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
    const feed = url.searchParams.get("feed") === "scroll" ? "scroll" : "swipe";
    const scrollTabRaw = url.searchParams.get("scrollTab");
    const scrollTab =
      scrollTabRaw === "interested" || scrollTabRaw === "passed" ? scrollTabRaw : ("new" as const);

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
            onboardingTrackSpecialist: true,
            certificationReviewStatus: true,
            nutritionistCertificationReviewStatus: true,
            specialistCertificationReviewStatus: true,
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
          onboardingTrackSpecialist: profile.onboardingTrackSpecialist,
          certificationReviewStatus: profile.certificationReviewStatus,
          nutritionistCertificationReviewStatus: profile.nutritionistCertificationReviewStatus,
          specialistCertificationReviewStatus: profile.specialistCertificationReviewStatus,
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
    let list = (filtered.length ? filtered : scored).sort((a, b) => b.score - a.score);

    const [passRows, savedRows, matchedConvs, matchFeedBlockedTrainerIds] = await Promise.all([
      prisma.clientTrainerBrowsePass.findMany({
        where: { clientId },
        select: { trainerId: true, createdAt: true, lastPassedAt: true },
      }),
      prisma.clientSavedTrainer.findMany({
        where: { clientId },
        select: { trainerId: true, trainerInquiryStatus: true, createdAt: true },
      }),
      prisma.trainerClientConversation.findMany({
        where: { clientId, officialChatStartedAt: { not: null } },
        select: { trainerId: true },
      }),
      getTrainerIdsHiddenFromClientMatchFeed(clientId),
    ]);
    const matchedTrainerIds = new Set(matchedConvs.map((c) => c.trainerId));
    const passByTrainerId = new Map(passRows.map((r) => [r.trainerId, r]));
    const savedByTrainerId = new Map(savedRows.map((r) => [r.trainerId, r]));

    list = list.filter((t) => !matchedTrainerIds.has(t.id) && !matchFeedBlockedTrainerIds.has(t.id));
    const scoredById = new Map(scored.map((r) => [r.id, r]));

    function trainerInNewBrowseDeck(trainerId: string): boolean {
      if (matchedTrainerIds.has(trainerId)) return false;
      if (savedByTrainerId.has(trainerId)) return false;
      const pass = passByTrainerId.get(trainerId);
      if (!pass) return true;
      return !isBrowsePassCooldownActive(pass.lastPassedAt, pass.createdAt);
    }

    const interestedTrainerIds = [
      ...new Set(
        savedRows
          .filter(
            (s) =>
              !matchedTrainerIds.has(s.trainerId) &&
              !matchFeedBlockedTrainerIds.has(s.trainerId) &&
              (s.trainerInquiryStatus === "PENDING_TRAINER" || s.trainerInquiryStatus === "DECLINED"),
          )
          .map((s) => s.trainerId),
      ),
    ];

    const newDeckOrdered = list.filter((t) => trainerInNewBrowseDeck(t.id));

    const newCount = newDeckOrdered.length;
    const interestedCount = interestedTrainerIds.length;
    const passedCount = passRows.filter((p) =>
      isWithinNotInterestedHistoryWindow(p.lastPassedAt, p.createdAt),
    ).length;

    let responseList: Array<
      (typeof list)[number] & {
        inquiryStatus?: "PENDING_TRAINER" | "DECLINED";
        passedAt?: string;
      }
    > = [];

    if (feed === "swipe") {
      responseList = newDeckOrdered;
    } else if (scrollTab === "new") {
      responseList = newDeckOrdered;
    } else if (scrollTab === "interested") {
      const rank = (st: string) => (st === "PENDING_TRAINER" ? 0 : 1);
      responseList = interestedTrainerIds
        .map((id) => scoredById.get(id))
        .filter((t): t is NonNullable<typeof t> => Boolean(t))
        .sort((a, b) => {
          const sa = savedByTrainerId.get(a.id)!;
          const sb = savedByTrainerId.get(b.id)!;
          const dr = rank(sa.trainerInquiryStatus) - rank(sb.trainerInquiryStatus);
          if (dr !== 0) return dr;
          return sb.createdAt.getTime() - sa.createdAt.getTime();
        })
        .map((t) => {
          const st = savedByTrainerId.get(t.id)!.trainerInquiryStatus;
          return {
            ...t,
            inquiryStatus: st as "PENDING_TRAINER" | "DECLINED",
          };
        });
    } else {
      const nowMs = Date.now();
      responseList = passRows
        .filter(
          (p) =>
            isWithinNotInterestedHistoryWindow(p.lastPassedAt, p.createdAt, nowMs) &&
            !matchFeedBlockedTrainerIds.has(p.trainerId),
        )
        .map((p) => {
          const row = scoredById.get(p.trainerId);
          if (!row) return null;
          const at = effectiveBrowsePassAt(p.lastPassedAt, p.createdAt);
          return {
            ...row,
            passedAt: at.toISOString(),
          };
        })
        .filter((t): t is NonNullable<typeof t> => t !== null)
        .sort((a, b) => new Date(b.passedAt!).getTime() - new Date(a.passedAt!).getTime());
    }

    return NextResponse.json({
      trainers: responseList,
      feed,
      scrollTab: feed === "scroll" ? scrollTab : undefined,
      scrollTabCounts:
        feed === "scroll" ? { new: newCount, interested: interestedCount, passed: passedCount } : undefined,
      passCooldownDays: CLIENT_TRAINER_PASS_COOLDOWN_DAYS,
      notInterestedHistoryDays: CLIENT_TRAINER_NOT_INTERESTED_UI_HISTORY_DAYS,
      relaxed: relaxed || (filtered.length === 0 && scored.length > 0),
      preferencesComplete: Boolean(client.matchPreferencesCompletedAt),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not load trainers." }, { status: 500 });
  }
}
