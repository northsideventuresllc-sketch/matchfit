import { prisma } from "@/lib/prisma";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";
import { getSessionTrainerId } from "@/lib/session";
import { isTrainerComplianceComplete } from "@/lib/trainer-compliance-complete";
import { conversationArchiveMetaForActor, purgeExpiredArchivedConversations } from "@/lib/trainer-client-conversation-archive";
import { getClientIdsWithChatBlockedForTrainer } from "@/lib/user-block-queries";
import { NextResponse } from "next/server";

function displayClientName(c: { preferredName: string; firstName: string; lastName: string }): string {
  return c.preferredName?.trim() || [c.firstName, c.lastName].filter(Boolean).join(" ").trim() || "Client";
}

export async function GET() {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const trainer = await prisma.trainer.findUnique({
      where: { id: trainerId },
      select: {
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
    });
    if (!trainer?.profile || trainer.profile.dashboardActivatedAt == null || !isTrainerComplianceComplete(trainer.profile)) {
      return NextResponse.json({ error: "Your trainer profile must be live." }, { status: 403 });
    }

    await purgeExpiredArchivedConversations();

    const [convs, chatBlockedClientIds] = await Promise.all([
      prisma.trainerClientConversation.findMany({
      where: { trainerId },
      orderBy: { updatedAt: "desc" },
      take: 120,
      select: {
        clientId: true,
        updatedAt: true,
        relationshipStage: true,
        officialChatStartedAt: true,
        archivedAt: true,
        archiveExpiresAt: true,
        unmatchInitiatedBy: true,
        client: {
          select: {
            username: true,
            preferredName: true,
            firstName: true,
            lastName: true,
            profileImageUrl: true,
          },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { body: true, authorRole: true, createdAt: true },
        },
      },
    }),
      getClientIdsWithChatBlockedForTrainer(trainerId),
    ]);

    type Row = {
      clientUsername: string;
      displayName: string;
      profileImageUrl: string | null;
      relationshipStage: string;
      officialChatStartedAt: string | null;
      lastMessagePreview: string | null;
      lastMessageAt: string;
      archived?: boolean;
      canRevive?: boolean;
      archiveExpiresAt?: string | null;
    };

    const activeThreads: Row[] = [];
    const archivedThreads: Row[] = [];
    const now = Date.now();

    for (const c of convs) {
      if (chatBlockedClientIds.has(c.clientId)) continue;
      const last = c.messages[0];
      const meta = conversationArchiveMetaForActor({
        conv: {
          archivedAt: c.archivedAt,
          archiveExpiresAt: c.archiveExpiresAt,
          unmatchInitiatedBy: c.unmatchInitiatedBy,
        },
        actor: "TRAINER",
      });
      const row: Row = {
        clientUsername: c.client.username,
        displayName: displayClientName(c.client),
        profileImageUrl: c.client.profileImageUrl,
        relationshipStage: c.relationshipStage,
        officialChatStartedAt: c.officialChatStartedAt?.toISOString() ?? null,
        lastMessagePreview: last ? last.body.slice(0, 160) : null,
        lastMessageAt: last?.createdAt.toISOString() ?? c.updatedAt.toISOString(),
      };

      if (meta.archived && c.archiveExpiresAt && c.archiveExpiresAt.getTime() > now) {
        archivedThreads.push({
          ...row,
          archived: true,
          canRevive: meta.canRevive,
          archiveExpiresAt: meta.archiveExpiresAt,
        });
      } else if (!c.archivedAt) {
        activeThreads.push(row);
      }
    }

    return NextResponse.json({ activeThreads, archivedThreads });
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Could not load conversations.", {
      logLabel: "[api/trainer/conversations]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
