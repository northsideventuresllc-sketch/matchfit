import { prisma } from "@/lib/prisma";
import { isPrismaMissingTableError } from "@/lib/prisma-missing-column";
import { defaultSessionEndAt, TRAINER_PUNCH_LATE_GRACE_MS } from "@/lib/session-check-in";
import { suspendTrainerForGovernance } from "@/lib/trainer-suspension-marketplace";

/** After session end + grace, sessions without a SESSION STARTED punch increment trainer miss streak (Terms). */
export async function processTrainerSessionPunchMisses(now = new Date()): Promise<number> {
  try {
    await prisma.sessionTrainerPunchIn.findFirst({ take: 1 });
  } catch (e) {
    if (isPrismaMissingTableError(e, "session_trainer_punch_ins")) return 0;
    throw e;
  }

  const candidates = await prisma.bookedTrainingSession.findMany({
    where: {
      status: "CLIENT_CONFIRMED",
      punchMissEvaluatedAt: null,
      scheduledStartAt: { lt: new Date(now.getTime() - 45 * 60 * 1000) },
    },
    take: 150,
    select: {
      id: true,
      trainerId: true,
      scheduledStartAt: true,
      scheduledEndAt: true,
    },
  });

  let processed = 0;
  for (const b of candidates) {
    const end = defaultSessionEndAt({ scheduledStartAt: b.scheduledStartAt, scheduledEndAt: b.scheduledEndAt });
    if (now.getTime() < end.getTime() + TRAINER_PUNCH_LATE_GRACE_MS) continue;

    const punch = await prisma.sessionTrainerPunchIn.findUnique({
      where: { bookedTrainingSessionId: b.id },
      select: { id: true },
    });

    await prisma.bookedTrainingSession.update({
      where: { id: b.id },
      data: { punchMissEvaluatedAt: now, updatedAt: now },
    });
    processed += 1;

    if (punch) continue;

    const prof = await prisma.trainerProfile.findUnique({
      where: { trainerId: b.trainerId },
      select: { consecutiveMissedSessionPunches: true },
    });
    const next = (prof?.consecutiveMissedSessionPunches ?? 0) + 1;
    await prisma.trainerProfile.update({
      where: { trainerId: b.trainerId },
      data: { consecutiveMissedSessionPunches: next },
    });

    if (next >= 5) {
      const t = await prisma.trainer.findUnique({
        where: { id: b.trainerId },
        select: { safetySuspended: true },
      });
      if (t && !t.safetySuspended) {
        await suspendTrainerForGovernance({ trainerId: b.trainerId, reasonCode: "PUNCH_STREAK" });
      }
    }
  }
  return processed;
}
