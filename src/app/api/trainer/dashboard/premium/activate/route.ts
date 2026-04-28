import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { NextResponse } from "next/server";

/** Marks Premium Page / studio as enabled for the signed-in trainer (skeleton until paid checkout exists). */
export async function POST() {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    await prisma.trainerProfile.upsert({
      where: { trainerId },
      create: {
        trainerId,
        premiumStudioEnabledAt: new Date(),
      },
      update: {
        premiumStudioEnabledAt: new Date(),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not activate Premium Page." }, { status: 500 });
  }
}
