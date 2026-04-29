import { ensureStarterTrainerNotifications } from "@/lib/trainer-notification-seed";
import { ensureFitHubStudioDigestTrainerNotification } from "@/lib/trainer-fithub-studio-activity";
import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const trainer = await prisma.trainer.findUnique({ where: { id: trainerId }, select: { id: true } });
    if (!trainer) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    await ensureStarterTrainerNotifications(trainerId);
    await ensureFitHubStudioDigestTrainerNotification(trainerId);

    const [items, unreadCount] = await Promise.all([
      prisma.trainerNotification.findMany({
        where: { trainerId },
        orderBy: { createdAt: "desc" },
        take: 80,
        select: {
          id: true,
          kind: true,
          title: true,
          body: true,
          linkHref: true,
          readAt: true,
          createdAt: true,
        },
      }),
      prisma.trainerNotification.count({
        where: { trainerId, readAt: null },
      }),
    ]);

    return NextResponse.json({
      unreadCount,
      notifications: items.map((n) => ({
        id: n.id,
        kind: n.kind,
        title: n.title,
        body: n.body,
        linkHref: n.linkHref,
        read: n.readAt != null,
        createdAt: n.createdAt.toISOString(),
      })),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not load notifications." }, { status: 500 });
  }
}
