import { prisma } from "@/lib/prisma";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";
import { getSessionTrainerId } from "@/lib/session";
import {
  cancelTrainerPayoutSchedule,
  upsertTrainerPayoutSchedule,
  type TrainerPayoutCadence,
  type TrainerPayoutMethod,
} from "@/lib/trainer-payouts";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET() {
  const trainerId = await getSessionTrainerId();
  if (!trainerId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const schedule = await prisma.trainerPayoutSchedule.findFirst({
    where: { trainerId, active: true },
  });
  return NextResponse.json({ schedule });
}

const bodySchema = z.object({
  amountCents: z.number().int().positive().nullable(),
  method: z.enum(["INSTANT", "STANDARD"]),
  cadence: z.enum(["ONE_TIME", "WEEKLY", "BIWEEKLY", "MONTHLY"]),
  nextRunAt: z.string().datetime(),
});

export async function POST(req: Request) {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
    }
    const data = parsed.data as {
      amountCents: number | null;
      method: TrainerPayoutMethod;
      cadence: TrainerPayoutCadence;
      nextRunAt: string;
    };
    const nextRunAt = new Date(data.nextRunAt);
    if (nextRunAt.getTime() <= Date.now()) {
      return NextResponse.json({ error: "Choose a future date and time." }, { status: 400 });
    }

    const schedule = await upsertTrainerPayoutSchedule({
      trainerId,
      amountCents: data.amountCents,
      method: data.method,
      cadence: data.cadence,
      nextRunAt,
    });
    return NextResponse.json({ schedule });
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Could not save schedule.", {
      logLabel: "[trainer payouts schedule]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE() {
  const trainerId = await getSessionTrainerId();
  if (!trainerId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  await cancelTrainerPayoutSchedule(trainerId);
  return NextResponse.json({ ok: true });
}
