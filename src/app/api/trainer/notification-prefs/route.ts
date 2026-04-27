import {
  parseTrainerNotificationPrefsJson,
  serializeTrainerNotificationPrefs,
  trainerNotificationPrefsSchema,
} from "@/lib/trainer-notification-prefs";
import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const trainer = await prisma.trainer.findUnique({
      where: { id: trainerId },
      select: { notificationPrefsJson: true },
    });
    if (!trainer) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    return NextResponse.json({
      preferences: parseTrainerNotificationPrefsJson(trainer.notificationPrefsJson),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not load notification settings." }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const body = (await req.json()) as { preferences?: unknown };
    const parsed = trainerNotificationPrefsSchema.safeParse(body.preferences);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid preferences." }, { status: 400 });
    }
    await prisma.trainer.update({
      where: { id: trainerId },
      data: { notificationPrefsJson: serializeTrainerNotificationPrefs(parsed.data) },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not save notification settings." }, { status: 500 });
  }
}
