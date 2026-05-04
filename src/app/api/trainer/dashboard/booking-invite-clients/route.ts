import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { isTrainerComplianceComplete } from "@/lib/trainer-compliance-complete";
import { getClientIdsWithChatBlockedForTrainer } from "@/lib/user-block-queries";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function displayClientName(c: { preferredName: string; firstName: string; lastName: string; username: string }): string {
  return c.preferredName?.trim() || [c.firstName, c.lastName].filter(Boolean).join(" ").trim() || c.username;
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
            backgroundCheckClearedAt: true,
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

    const [convs, chatBlockedClientIds] = await Promise.all([
      prisma.trainerClientConversation.findMany({
        where: { trainerId, officialChatStartedAt: { not: null }, archivedAt: null },
        orderBy: { updatedAt: "desc" },
        take: 200,
        select: {
          clientId: true,
          client: {
            select: { username: true, preferredName: true, firstName: true, lastName: true },
          },
        },
      }),
      getClientIdsWithChatBlockedForTrainer(trainerId),
    ]);

    const eligible: { clientUsername: string; displayName: string }[] = [];
    const clientIds = convs.map((c) => c.clientId).filter((id) => !chatBlockedClientIds.has(id));
    const uniqueIds = [...new Set(clientIds)];

    const paidRows = await prisma.trainerClientServiceTransaction.findMany({
      where: { trainerId, clientId: { in: uniqueIds } },
      select: { clientId: true },
      distinct: ["clientId"],
    });
    const paidSet = new Set(paidRows.map((r) => r.clientId));

    for (const c of convs) {
      if (chatBlockedClientIds.has(c.clientId)) continue;
      if (!paidSet.has(c.clientId)) continue;
      eligible.push({
        clientUsername: c.client.username,
        displayName: displayClientName(c.client),
      });
    }

    const seen = new Set<string>();
    const deduped = eligible.filter((r) => {
      if (seen.has(r.clientUsername)) return false;
      seen.add(r.clientUsername);
      return true;
    });

    return NextResponse.json({ clients: deduped });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not load clients." }, { status: 500 });
  }
}
