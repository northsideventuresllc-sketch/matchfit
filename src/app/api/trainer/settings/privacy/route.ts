import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import {
  parseTrainerOptionalProfileVisibility,
  serializeTrainerOptionalProfileVisibility,
  type TrainerOptionalProfileVisibility,
} from "@/lib/optional-profile-visibility";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";
import { listBlocksInitiatedByTrainer } from "@/lib/user-block-queries";
import { NextResponse } from "next/server";
import { z } from "zod";

const patchSchema = z.object({
  showPronouns: z.boolean().optional(),
  showEthnicity: z.boolean().optional(),
  showGenderIdentity: z.boolean().optional(),
  showLanguagesSpoken: z.boolean().optional(),
});

export async function GET() {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const trainer = await prisma.trainer.findUnique({
      where: { id: trainerId },
      select: { optionalProfileVisibilityJson: true, privacyPolicyAcceptedAt: true, deidentifiedAt: true },
    });
    if (!trainer || trainer.deidentifiedAt) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const blockedProfiles = (await listBlocksInitiatedByTrainer(trainerId)).map((b) => ({
      id: b.id,
      username: b.targetUsername,
      displayName: b.targetDisplayName,
      kind: b.blockedIsTrainer ? ("trainer" as const) : ("client" as const),
      hideTrainerFromClientMatchFeed: b.hideTrainerFromClientMatchFeed,
      hideTrainerFromClientFithub: b.hideTrainerFromClientFithub,
      hideClientFromTrainerDiscover: b.hideClientFromTrainerDiscover,
      hideBlockedTrainerFromViewerTrainerFithub: b.hideBlockedTrainerFromViewerTrainerFithub,
      blockDirectChat: b.blockDirectChat,
    }));

    return NextResponse.json({
      visibility: parseTrainerOptionalProfileVisibility(trainer.optionalProfileVisibilityJson),
      privacyPolicyAcceptedAt: trainer.privacyPolicyAcceptedAt?.toISOString() ?? null,
      blockedProfiles,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not load privacy settings." }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const body = patchSchema.safeParse(await req.json().catch(() => ({})));
    if (!body.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }
    const cur = await prisma.trainer.findUnique({
      where: { id: trainerId },
      select: { optionalProfileVisibilityJson: true, deidentifiedAt: true },
    });
    if (!cur || cur.deidentifiedAt) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const merged: TrainerOptionalProfileVisibility = {
      ...parseTrainerOptionalProfileVisibility(cur.optionalProfileVisibilityJson),
      ...body.data,
    };
    await prisma.trainer.update({
      where: { id: trainerId },
      data: {
        optionalProfileVisibilityJson: serializeTrainerOptionalProfileVisibility(
          merged,
          cur.optionalProfileVisibilityJson,
        ),
      },
    });
    return NextResponse.json({ ok: true, visibility: merged });
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Could not update privacy settings.", {
      logLabel: "[trainer settings privacy]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
