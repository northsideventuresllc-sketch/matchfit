import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { hasTrainerFullPlatformAccess } from "@/lib/trainer-full-access";
import { trainerFullAccessBlockedMessage } from "@/lib/assert-trainer-full-access";
import { trainerFullAccessProfileSelect } from "@/lib/trainer-full-access-profile-select";
import { NextResponse } from "next/server";

/** Marks Premium Page / studio as enabled for the signed-in trainer (skeleton until paid checkout exists). */
export async function POST() {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const profile = await prisma.trainerProfile.findUnique({
      where: { trainerId },
      select: trainerFullAccessProfileSelect,
    });
    if (!hasTrainerFullPlatformAccess(profile)) {
      return NextResponse.json({ error: trainerFullAccessBlockedMessage() }, { status: 403 });
    }

    await prisma.trainerProfile.update({
      where: { trainerId },
      data: { premiumStudioEnabledAt: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not activate Premium Page." }, { status: 500 });
  }
}
