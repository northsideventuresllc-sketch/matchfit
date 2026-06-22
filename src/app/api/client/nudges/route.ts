import { canSeeNudgeSenderIdentity, clientPlanAccessSelect } from "@/lib/client-plan-access";
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

export async function GET() {
  try {
    const clientId = await getSessionClientId();
    if (!clientId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const [client, nudges] = await Promise.all([
      prisma.client.findUnique({
        where: { id: clientId },
        select: clientPlanAccessSelect,
      }),
      prisma.trainerClientNudge.findMany({
        where: { clientId },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          trainer: {
            select: {
              username: true,
              firstName: true,
              lastName: true,
              preferredName: true,
              profileImageUrl: true,
            },
          },
        },
      }),
    ]);

    if (!client) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const showSender = canSeeNudgeSenderIdentity(client);

    return NextResponse.json({
      nudges: nudges.map((n) => ({
        id: n.id,
        createdAt: n.createdAt.toISOString(),
        readAt: n.readAt?.toISOString() ?? null,
        message: showSender ? n.message : null,
        anonymous: !showSender,
        trainerUsername: showSender ? n.trainer.username : null,
        displayName: showSender ? coachDisplayName(n.trainer) : "A Fitness Pro",
        profileImageUrl: showSender ? n.trainer.profileImageUrl : null,
        chatHref: showSender ? `/client/messages/${encodeURIComponent(n.trainer.username)}` : null,
      })),
      canSeeSenderIdentity: showSender,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not load nudges." }, { status: 500 });
  }
}
