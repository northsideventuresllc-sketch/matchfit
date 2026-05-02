import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const rows = await prisma.trainerVideoConferenceConnection.findMany({
      where: { trainerId, revokedAt: null },
      select: {
        provider: true,
        externalAccountHint: true,
        createdAt: true,
        updatedAt: true,
        accessTokenExpiresAt: true,
      },
    });
    return NextResponse.json({
      connections: rows.map((r) => ({
        provider: r.provider,
        hint: r.externalAccountHint,
        connectedAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        accessTokenExpiresAt: r.accessTokenExpiresAt?.toISOString() ?? null,
      })),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not load connections." }, { status: 500 });
  }
}
