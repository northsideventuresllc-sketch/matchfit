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

    const nudges = await prisma.trainerClientNudge.findMany({
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
    });

    return NextResponse.json({
      nudges: nudges.map((n) => ({
        id: n.id,
        createdAt: n.createdAt.toISOString(),
        readAt: n.readAt?.toISOString() ?? null,
        message: n.message,
        trainerUsername: n.trainer.username,
        displayName: coachDisplayName(n.trainer),
        profileImageUrl: n.trainer.profileImageUrl,
        chatHref: `/client/messages/${encodeURIComponent(n.trainer.username)}`,
      })),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not load nudges." }, { status: 500 });
  }
}
