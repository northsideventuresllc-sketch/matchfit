import { prisma } from "@/lib/prisma";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";
import { getSessionClientId } from "@/lib/session";
import { isTrainerComplianceComplete } from "@/lib/trainer-compliance-complete";
import { conversationArchiveMetaForActor, purgeExpiredArchivedConversations } from "@/lib/trainer-client-conversation-archive";
import { getTrainerIdsWithChatBlockedForClient } from "@/lib/user-block-queries";
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

export async function GET() {
  try {
    const clientId = await getSessionClientId();
    if (!clientId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    await purgeExpiredArchivedConversations();

    const [nudgeRows, saved, convs, chatBlockedTrainerIds] = await Promise.all([
      prisma.trainerClientNudge.findMany({
        where: { clientId },
        orderBy: { createdAt: "desc" },
        take: 120,
        include: {
          trainer: {
            select: {
              username: true,
              firstName: true,
              lastName: true,
              preferredName: true,
              profileImageUrl: true,
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
                },
              },
            },
          },
        },
      }),
      prisma.clientSavedTrainer.findMany({
        where: { clientId },
        orderBy: { createdAt: "desc" },
        include: {
          trainer: {
            select: {
              username: true,
              firstName: true,
              lastName: true,
              preferredName: true,
              profileImageUrl: true,
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
                },
              },
            },
          },
        },
      }),
      prisma.trainerClientConversation.findMany({
        where: { clientId },
        orderBy: { updatedAt: "desc" },
        take: 120,
        select: {
          trainerId: true,
          updatedAt: true,
          officialChatStartedAt: true,
          archivedAt: true,
          archiveExpiresAt: true,
          unmatchInitiatedBy: true,
          trainer: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              preferredName: true,
              profileImageUrl: true,
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
                },
              },
            },
          },
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { createdAt: true },
          },
        },
      }),
      getTrainerIdsWithChatBlockedForClient(clientId),
    ]);

    type Row = {
      trainerUsername: string;
      displayName: string;
      profileImageUrl: string | null;
      href: string;
      source: "nudge" | "saved" | "conversation";
      lastActivityAt: string;
      chatOpen: boolean;
      archived?: boolean;
      canRevive?: boolean;
      archiveExpiresAt?: string | null;
    };

    const convByTrainerId = new Map(convs.map((c) => [c.trainerId, c]));

    const activeByUser = new Map<string, Row>();
    const archiveByUser = new Map<string, Row>();

    const seenTrainer = new Set<string>();
    const nudges: typeof nudgeRows = [];
    for (const n of nudgeRows) {
      if (seenTrainer.has(n.trainerId)) continue;
      seenTrainer.add(n.trainerId);
      nudges.push(n);
    }

    for (const n of nudges) {
      const t = n.trainer;
      if (chatBlockedTrainerIds.has(n.trainerId)) continue;
      if (!t.profile || t.profile.dashboardActivatedAt == null || !isTrainerComplianceComplete(t.profile)) continue;
      const conv = convByTrainerId.get(n.trainerId);
      if (conv?.archivedAt) continue;
      activeByUser.set(t.username, {
        trainerUsername: t.username,
        displayName: coachDisplayName(t),
        profileImageUrl: t.profileImageUrl,
        href: `/client/messages/${encodeURIComponent(t.username)}`,
        source: "nudge",
        lastActivityAt: n.createdAt.toISOString(),
        chatOpen: false,
      });
    }

    for (const s of saved) {
      const t = s.trainer;
      if (chatBlockedTrainerIds.has(s.trainerId)) continue;
      if (!t.profile || t.profile.dashboardActivatedAt == null || !isTrainerComplianceComplete(t.profile)) continue;
      const conv = convByTrainerId.get(s.trainerId);
      if (conv?.archivedAt) continue;
      const existing = activeByUser.get(t.username);
      const at = s.createdAt.toISOString();
      if (!existing) {
        activeByUser.set(t.username, {
          trainerUsername: t.username,
          displayName: coachDisplayName(t),
          profileImageUrl: t.profileImageUrl,
          href: `/client/messages/${encodeURIComponent(t.username)}`,
          source: "saved",
          lastActivityAt: at,
          chatOpen: false,
        });
      } else if (at > existing.lastActivityAt) {
        activeByUser.set(t.username, {
          ...existing,
          lastActivityAt: at,
          source: existing.source === "nudge" ? "nudge" : "saved",
        });
      }
    }

    for (const conv of convs) {
      const t = conv.trainer;
      if (!t.profile || t.profile.dashboardActivatedAt == null || !isTrainerComplianceComplete(t.profile)) continue;
      if (chatBlockedTrainerIds.has(t.id)) continue;
      const at = conv.messages[0]?.createdAt.toISOString() ?? conv.updatedAt.toISOString();
      const chatOpen = Boolean(conv.officialChatStartedAt);
      const meta = conversationArchiveMetaForActor({
        conv: {
          archivedAt: conv.archivedAt,
          archiveExpiresAt: conv.archiveExpiresAt,
          unmatchInitiatedBy: conv.unmatchInitiatedBy,
        },
        actor: "CLIENT",
      });

      if (meta.archived && conv.archiveExpiresAt && conv.archiveExpiresAt.getTime() > Date.now()) {
        archiveByUser.set(t.username, {
          trainerUsername: t.username,
          displayName: coachDisplayName(t),
          profileImageUrl: t.profileImageUrl,
          href: `/client/messages/${encodeURIComponent(t.username)}`,
          source: "conversation",
          lastActivityAt: at,
          chatOpen: false,
          archived: true,
          canRevive: meta.canRevive,
          archiveExpiresAt: meta.archiveExpiresAt,
        });
        continue;
      }

      const existing = activeByUser.get(t.username);
      if (!existing) {
        activeByUser.set(t.username, {
          trainerUsername: t.username,
          displayName: coachDisplayName(t),
          profileImageUrl: t.profileImageUrl,
          href: `/client/messages/${encodeURIComponent(t.username)}`,
          source: "conversation",
          lastActivityAt: at,
          chatOpen,
        });
      } else {
        activeByUser.set(t.username, {
          ...existing,
          lastActivityAt: at > existing.lastActivityAt ? at : existing.lastActivityAt,
          chatOpen: existing.chatOpen || chatOpen,
        });
      }
    }

    const activeThreads = [...activeByUser.values()].sort((a, b) => (a.lastActivityAt < b.lastActivityAt ? 1 : -1));
    const archivedThreads = [...archiveByUser.values()].sort((a, b) => (a.lastActivityAt < b.lastActivityAt ? 1 : -1));

    return NextResponse.json({ activeThreads, archivedThreads });
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Could not load chats.", {
      logLabel: "[api/client/chats]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
