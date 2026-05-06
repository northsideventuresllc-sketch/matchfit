import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const url = new URL(req.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const start = from ? new Date(from) : new Date(Date.now() - 7 * 86400000);
    const end = to ? new Date(to) : new Date(Date.now() + 120 * 86400000);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return NextResponse.json({ error: "Invalid date range." }, { status: 400 });
    }

    const rows = await prisma.bookedTrainingSession.findMany({
      where: {
        trainerId,
        scheduledStartAt: { gte: start, lte: end },
        status: { not: "CANCELLED" },
      },
      orderBy: { scheduledStartAt: "asc" },
      take: 200,
      select: {
        id: true,
        status: true,
        scheduledStartAt: true,
        scheduledEndAt: true,
        inviteNote: true,
        sessionDelivery: true,
        videoConferenceJoinUrl: true,
        videoConferenceProvider: true,
        client: { select: { username: true, preferredName: true, firstName: true, lastName: true } },
      },
    });

    return NextResponse.json({
      bookings: rows.map((r) => ({
        id: r.id,
        status: r.status,
        startsAt: r.scheduledStartAt.toISOString(),
        endsAt: r.scheduledEndAt?.toISOString() ?? null,
        inviteNote: r.inviteNote,
        sessionDelivery: r.sessionDelivery,
        videoConferenceJoinUrl: r.videoConferenceJoinUrl,
        videoConferenceProvider: r.videoConferenceProvider,
        clientUsername: r.client.username,
        clientLabel:
          r.client.preferredName?.trim() ||
          [r.client.firstName, r.client.lastName].filter(Boolean).join(" ").trim() ||
          r.client.username,
      })),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not load bookings." }, { status: 500 });
  }
}
