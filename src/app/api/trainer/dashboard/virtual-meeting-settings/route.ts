import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import {
  parseTrainerVirtualMeetingSettings,
  serializeTrainerVirtualMeetingSettings,
} from "@/lib/trainer-virtual-meeting-settings";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  defaultDurationMins: z.number().int().min(15).max(240).optional(),
  preferredSyncPlatform: z.enum(["GOOGLE", "ZOOM", "MICROSOFT"]).nullable().optional(),
  remindFiveMinutesBefore: z.boolean().optional(),
});

export async function GET() {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const row = await prisma.trainerProfile.findUnique({
      where: { trainerId },
      select: { virtualMeetingSettingsJson: true },
    });
    return NextResponse.json({
      prefs: parseTrainerVirtualMeetingSettings(row?.virtualMeetingSettingsJson),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not load settings." }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }
    const cur = await prisma.trainerProfile.findUnique({
      where: { trainerId },
      select: { virtualMeetingSettingsJson: true },
    });
    const nextJson = serializeTrainerVirtualMeetingSettings(cur?.virtualMeetingSettingsJson, parsed.data);
    await prisma.trainerProfile.update({
      where: { trainerId },
      data: { virtualMeetingSettingsJson: nextJson, updatedAt: new Date() },
    });
    return NextResponse.json({ ok: true, prefs: parseTrainerVirtualMeetingSettings(nextJson) });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not save settings." }, { status: 500 });
  }
}
