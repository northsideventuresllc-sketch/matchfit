import { prisma } from "@/lib/prisma";
import {
  parseTrainerVirtualMeetingSettings,
} from "@/lib/trainer-virtual-meeting-settings";
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

export async function GET() {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const [profile, connections, now] = await Promise.all([
      prisma.trainerProfile.findUnique({
        where: { trainerId },
        select: { virtualMeetingSettingsJson: true },
      }),
      prisma.trainerVideoConferenceConnection.findMany({
        where: { trainerId, revokedAt: null },
        select: { provider: true, externalAccountHint: true },
      }),
      Promise.resolve(new Date()),
    ]);

    const horizon = new Date(now.getTime() - 5 * 60 * 1000);

    const upcomingWhere = {
      trainerId,
      sessionDelivery: "VIRTUAL" as const,
      status: { not: "CANCELLED" as const },
      scheduledStartAt: { gte: horizon },
    };

    const [upcomingRows, upcomingTotal, pastRows] = await Promise.all([
      prisma.bookedTrainingSession.findMany({
        where: upcomingWhere,
        orderBy: { scheduledStartAt: "asc" },
        take: 20,
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
      }),
      prisma.bookedTrainingSession.count({ where: upcomingWhere }),
      prisma.bookedTrainingSession.findMany({
        where: {
          trainerId,
          sessionDelivery: "VIRTUAL",
          status: { not: "CANCELLED" },
          scheduledStartAt: { lt: now },
        },
        orderBy: { scheduledStartAt: "desc" },
        take: 8,
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
      }),
    ]);

    const mapRow = (r: (typeof upcomingRows)[0]) => ({
      id: r.id,
      startsAt: r.scheduledStartAt.toISOString(),
      endsAt: r.scheduledEndAt?.toISOString() ?? null,
      status: r.status,
      videoConferenceJoinUrl: r.videoConferenceJoinUrl,
      videoConferenceProvider: r.videoConferenceProvider,
      clientUsername: r.client.username,
      clientLabel: clientLabel(r.client),
    });

    const providerHit = (p: string) => connections.find((c) => c.provider === p);

    return NextResponse.json({
      prefs: parseTrainerVirtualMeetingSettings(profile?.virtualMeetingSettingsJson),
      platforms: [
        {
          key: "GOOGLE",
          label: "Google Meet",
          connected: Boolean(providerHit("GOOGLE")),
          hint: providerHit("GOOGLE")?.externalAccountHint ?? null,
        },
        {
          key: "ZOOM",
          label: "Zoom",
          connected: Boolean(providerHit("ZOOM")),
          hint: providerHit("ZOOM")?.externalAccountHint ?? null,
        },
        {
          key: "MICROSOFT",
          label: "Microsoft Teams",
          connected: Boolean(providerHit("MICROSOFT")),
          hint: providerHit("MICROSOFT")?.externalAccountHint ?? null,
        },
      ],
      upcomingVirtual: upcomingRows.slice(0, 4).map(mapRow),
      upcomingVirtualTotal: upcomingTotal,
      pastVirtual: pastRows.map(mapRow),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not load virtual meetings." }, { status: 500 });
  }
}
