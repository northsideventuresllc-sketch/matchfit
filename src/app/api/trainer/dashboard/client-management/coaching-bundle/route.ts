import { loadClientHistoryBundle } from "@/lib/trainer-client-management-dashboard";
import type { DiyEngagementDto } from "@/lib/trainer-client-coaching";
import { loadTrainerClientCoachingBundle } from "@/lib/trainer-client-coaching";
import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    const url = new URL(req.url);
    const clientId = url.searchParams.get("clientId")?.trim();
    if (!clientId) return NextResponse.json({ error: "clientId is required." }, { status: 400 });

    const ok = await prisma.bookedTrainingSession.findFirst({
      where: { trainerId, clientId },
      select: { id: true },
    });
    const conv = await prisma.trainerClientConversation.findFirst({
      where: { trainerId, clientId },
      select: { id: true },
    });
    if (!ok && !conv) return NextResponse.json({ error: "Not found." }, { status: 404 });

    const ledger = await loadClientHistoryBundle(trainerId, clientId);
    const coaching = await loadTrainerClientCoachingBundle(trainerId, clientId).catch((e) => {
      console.error("[coaching-bundle] coaching payload failed (DB migration or Prisma generate may be behind)", e);
      return {
        profile: { generalNotes: "", medicalInjuryNotes: "" },
        goals: [] as { id: string; horizon: string; goalText: string; completionCriteria: string; completedAt: string | null }[],
        sessionSummaries: [] as { id: string; occurredAt: string; body: string; emailedAt: string | null }[],
        diyEngagements: [] as DiyEngagementDto[],
        hasDiy: false,
        clientEmailMasked: false,
      };
    });
    return NextResponse.json({ ...ledger, ...coaching });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not load." }, { status: 500 });
  }
}
