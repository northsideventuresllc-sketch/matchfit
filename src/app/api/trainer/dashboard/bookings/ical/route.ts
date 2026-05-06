import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function icsEscapeText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,");
}

function toIcsUtc(d: Date): string {
  return d.toISOString().replace(/\.\d{3}Z$/, "Z").replace(/-/g, "").replace(/:/g, "");
}

export async function GET(req: Request) {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const url = new URL(req.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const start = from ? new Date(from) : new Date(Date.now() - 86400000);
    const end = to ? new Date(to) : new Date(Date.now() + 90 * 86400000);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
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
        scheduledStartAt: true,
        scheduledEndAt: true,
        status: true,
        client: { select: { username: true, preferredName: true, firstName: true, lastName: true } },
      },
    });

    const lines: string[] = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Match Fit//Trainer Bookings//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:Match Fit bookings",
    ];

    const now = new Date();
    for (const r of rows) {
      const label =
        r.client.preferredName?.trim() ||
        [r.client.firstName, r.client.lastName].filter(Boolean).join(" ").trim() ||
        r.client.username;
      const sum = `Match Fit · ${icsEscapeText(label)}`;
      const endAt = r.scheduledEndAt ?? new Date(r.scheduledStartAt.getTime() + 60 * 60 * 1000);
      lines.push("BEGIN:VEVENT");
      lines.push(`UID:${r.id}@matchfit.booking`);
      lines.push(`DTSTAMP:${toIcsUtc(now)}`);
      lines.push(`DTSTART:${toIcsUtc(r.scheduledStartAt)}`);
      lines.push(`DTEND:${toIcsUtc(endAt)}`);
      lines.push(`SUMMARY:${sum}`);
      lines.push(`DESCRIPTION:${icsEscapeText(`@${r.client.username} · ${r.status}`)}`);
      lines.push("END:VEVENT");
    }

    lines.push("END:VCALENDAR");
    const body = lines.join("\r\n") + "\r\n";

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="match-fit-bookings.ics"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not export calendar." }, { status: 500 });
  }
}
