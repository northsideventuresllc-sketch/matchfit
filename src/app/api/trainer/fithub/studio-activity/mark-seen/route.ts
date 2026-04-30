import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { FITHUB_STUDIO_DIGEST_TITLE, markTrainerFitHubStudioActivitySeen } from "@/lib/trainer-fithub-studio-activity";
import { isTrainerPremiumStudioActive } from "@/lib/trainer-premium-studio";
import { getSessionTrainerId } from "@/lib/session";

export async function POST() {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    if (!(await isTrainerPremiumStudioActive(trainerId))) {
      return NextResponse.json({ error: "Premium Page is required." }, { status: 403 });
    }

    await markTrainerFitHubStudioActivitySeen(trainerId);
    await prisma.trainerNotification.updateMany({
      where: { trainerId, title: FITHUB_STUDIO_DIGEST_TITLE, readAt: null },
      data: { readAt: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not update." }, { status: 500 });
  }
}
