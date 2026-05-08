import { loadClientHistoryBundle } from "@/lib/trainer-client-management-dashboard";
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

    const booking = await prisma.bookedTrainingSession.findFirst({
      where: { trainerId, clientId },
      select: { id: true },
    });
    const conv = await prisma.trainerClientConversation.findFirst({
      where: { trainerId, clientId },
      select: { id: true },
    });
    if (!booking && !conv) return NextResponse.json({ error: "Not found." }, { status: 404 });

    const bundle = await loadClientHistoryBundle(trainerId, clientId);
    return NextResponse.json(bundle);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not load history." }, { status: 500 });
  }
}
