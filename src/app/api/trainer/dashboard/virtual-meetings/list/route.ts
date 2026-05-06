import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function clientLabel(c: {
  preferredName: string | null;
  firstName: string;
  lastName: string;
  username: string;
}): string {
  return (
    c.preferredName?.trim() ||
    [c.firstName, c.lastName].filter(Boolean).join(" ").trim() ||
    c.username
  );
}

export async function GET(req: Request) {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const url = new URL(req.url);
    const scope = url.searchParams.get("scope") === "past" ? "past" : "upcoming";
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "40", 10) || 40));
    const now = new Date();

    const rows = await prisma.bookedTrainingSession.findMany({
      where: {
        trainerId,
        sessionDelivery: "VIRTUAL",
        status: { not: "CANCELLED" },
        scheduledStartAt:
          scope === "past" ? { lt: now } : { gte: new Date(now.getTime() - 5 * 60 * 1000) },
      },
      orderBy: { scheduledStartAt: scope === "past" ? "desc" : "asc" },
      take: limit,
      select: {
        id: true,
        scheduledStartAt: true,
        scheduledEndAt: true,
        status: true,
        videoConferenceJoinUrl: true,
        videoConferenceProvider: true,
        client: {
          select: { username: true, preferredName: true, firstName: true, lastName: true },
        },
      },
    });

    return NextResponse.json({
      scope,
      meetings: rows.map((r) => ({
        id: r.id,
        startsAt: r.scheduledStartAt.toISOString(),
        endsAt: r.scheduledEndAt?.toISOString() ?? null,
        status: r.status,
        videoConferenceJoinUrl: r.videoConferenceJoinUrl,
        videoConferenceProvider: r.videoConferenceProvider,
        clientUsername: r.client.username,
        clientLabel: clientLabel(r.client),
      })),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not load meetings." }, { status: 500 });
  }
}
