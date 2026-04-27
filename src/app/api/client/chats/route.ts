import { prisma } from "@/lib/prisma";
import { getSessionClientId } from "@/lib/session";
import { isTrainerComplianceComplete } from "@/lib/trainer-compliance-complete";
import { isTrainerClientPairBlocked } from "@/lib/user-block-queries";
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

    const [nudgeRows, saved, convs] = await Promise.all([
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
                  certificationReviewStatus: true,
                  nutritionistCertificationReviewStatus: true,
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
                  certificationReviewStatus: true,
                  nutritionistCertificationReviewStatus: true,
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
        include: {
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
                  certificationReviewStatus: true,
                  nutritionistCertificationReviewStatus: true,
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
    ]);

    type Row = {
      trainerUsername: string;
      displayName: string;
      profileImageUrl: string | null;
      href: string;
      source: "nudge" | "saved" | "conversation";
      lastActivityAt: string;
      chatOpen: boolean;
    };

    const byUser = new Map<string, Row>();

    const seenTrainer = new Set<string>();
    const nudges: typeof nudgeRows = [];
    for (const n of nudgeRows) {
      if (seenTrainer.has(n.trainerId)) continue;
      seenTrainer.add(n.trainerId);
      nudges.push(n);
    }

    for (const n of nudges) {
      const t = n.trainer;
      if (!t.profile || t.profile.dashboardActivatedAt == null || !isTrainerComplianceComplete(t.profile)) continue;
      byUser.set(t.username, {
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
      if (!t.profile || t.profile.dashboardActivatedAt == null || !isTrainerComplianceComplete(t.profile)) continue;
      const existing = byUser.get(t.username);
      const at = s.createdAt.toISOString();
      if (!existing) {
        byUser.set(t.username, {
          trainerUsername: t.username,
          displayName: coachDisplayName(t),
          profileImageUrl: t.profileImageUrl,
          href: `/client/messages/${encodeURIComponent(t.username)}`,
          source: "saved",
          lastActivityAt: at,
          chatOpen: false,
        });
      } else if (at > existing.lastActivityAt) {
        byUser.set(t.username, {
          ...existing,
          lastActivityAt: at,
          source: existing.source === "nudge" ? "nudge" : "saved",
        });
      }
    }

    for (const conv of convs) {
      const t = conv.trainer;
      if (!t.profile || t.profile.dashboardActivatedAt == null || !isTrainerComplianceComplete(t.profile)) continue;
      if (await isTrainerClientPairBlocked(t.id, clientId)) continue;
      const at =
        conv.messages[0]?.createdAt.toISOString() ?? conv.updatedAt.toISOString();
      const chatOpen = Boolean(conv.officialChatStartedAt);
      const existing = byUser.get(t.username);
      if (!existing) {
        byUser.set(t.username, {
          trainerUsername: t.username,
          displayName: coachDisplayName(t),
          profileImageUrl: t.profileImageUrl,
          href: `/client/messages/${encodeURIComponent(t.username)}`,
          source: "conversation",
          lastActivityAt: at,
          chatOpen,
        });
      } else {
        byUser.set(t.username, {
          ...existing,
          lastActivityAt: at > existing.lastActivityAt ? at : existing.lastActivityAt,
          chatOpen: existing.chatOpen || chatOpen,
        });
      }
    }

    const threads = [...byUser.values()].sort((a, b) => (a.lastActivityAt < b.lastActivityAt ? 1 : -1));

    return NextResponse.json({ threads });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not load chats." }, { status: 500 });
  }
}
