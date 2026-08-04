import { prisma } from "@/lib/prisma";
import { isPrismaMissingTableError } from "@/lib/prisma-missing-column";
import { defaultSessionEndAt, TRAINER_PUNCH_LATE_GRACE_MS } from "@/lib/session-check-in";
import { TOS_PUNCH_MISS_SUSPEND_STREAK } from "@/lib/tos-governance-thresholds";
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

  // Only sessions past end + grace are evaluated.
  const due = candidates.filter((b) => {
    const end = defaultSessionEndAt({
      scheduledStartAt: b.scheduledStartAt,
      scheduledEndAt: b.scheduledEndAt,
    });
    return now.getTime() >= end.getTime() + TRAINER_PUNCH_LATE_GRACE_MS;
  });
  if (due.length === 0) return 0;

  const dueIds = due.map((b) => b.id);

  // One query for every punch instead of one per session.
  const punches = await prisma.sessionTrainerPunchIn.findMany({
    where: { bookedTrainingSessionId: { in: dueIds } },
    select: { bookedTrainingSessionId: true },
  });
  const punched = new Set(punches.map((p) => p.bookedTrainingSessionId));

  // One write for every evaluated session instead of one per session.
  await prisma.bookedTrainingSession.updateMany({
    where: { id: { in: dueIds } },
    data: { punchMissEvaluatedAt: now, updatedAt: now },
  });
  const processed = due.length;

  // Count misses per trainer, then one atomic increment per trainer.
  const missesByTrainer = new Map<string, number>();
  for (const b of due) {
    if (punched.has(b.id)) continue;
    missesByTrainer.set(b.trainerId, (missesByTrainer.get(b.trainerId) ?? 0) + 1);
  }
  if (missesByTrainer.size === 0) return processed;

  const trainerIds = [...missesByTrainer.keys()];

  // increment is atomic, so two concurrent runs can no longer clobber each other
  // the way the old read-then-write did.
  await Promise.all(
    trainerIds.map((trainerId) =>
      prisma.trainerProfile.update({
        where: { trainerId },
        data: {
          consecutiveMissedSessionPunches: {
            increment: missesByTrainer.get(trainerId) ?? 1,
          },
        },
      }),
    ),
  );

  // Read the resulting streaks and suspension flags in two queries, not 2N.
  const [profiles, trainers] = await Promise.all([
    prisma.trainerProfile.findMany({
      where: { trainerId: { in: trainerIds } },
      select: { trainerId: true, consecutiveMissedSessionPunches: true },
    }),
    prisma.trainer.findMany({
      where: { id: { in: trainerIds } },
      select: { id: true, safetySuspended: true },
    }),
  ]);
  const alreadySuspended = new Set(
    trainers.filter((t) => t.safetySuspended).map((t) => t.id),
  );

  for (const p of profiles) {
    if (p.consecutiveMissedSessionPunches < TOS_PUNCH_MISS_SUSPEND_STREAK) continue;
    if (alreadySuspended.has(p.trainerId)) continue;
    await suspendTrainerForGovernance({
      trainerId: p.trainerId,
      reasonCode: "PUNCH_STREAK",
    });
  }

  return processed;
}
