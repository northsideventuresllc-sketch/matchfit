import { prisma } from "@/lib/prisma";

const FIVE_YEARS_MS = 1000 * 60 * 60 * 24 * 365 * 5;

/** Best-effort cleanup of aged suspension file rows (no cron yet). */
export async function purgeExpiredSuspensionRecords(now = new Date()): Promise<number> {
  const res = await prisma.suspensionRecord.deleteMany({
    where: {
      liftedAt: { not: null },
      purgeAfter: { lt: now },
    },
  });
  return res.count;
}

/** Returns a Prisma operation suitable for `$transaction([...])` batches. */
export function createSuspensionRecordForReport(args: {
  subjectIsTrainer: boolean;
  subjectId: string;
  reportId: string;
}) {
  const far = new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000);
  return prisma.suspensionRecord.create({
    data: {
      subjectIsTrainer: args.subjectIsTrainer,
      subjectId: args.subjectId,
      reportId: args.reportId,
      purgeAfter: far,
    },
  });
}

export async function finalizeSuspensionRecordOnLift(args: {
  subjectIsTrainer: boolean;
  subjectId: string;
}): Promise<void> {
  const now = new Date();
  const purgeAfter = new Date(now.getTime() + FIVE_YEARS_MS);
  await prisma.suspensionRecord.updateMany({
    where: {
      subjectIsTrainer: args.subjectIsTrainer,
      subjectId: args.subjectId,
      liftedAt: null,
    },
    data: {
      liftedAt: now,
      purgeAfter,
    },
  });
}
