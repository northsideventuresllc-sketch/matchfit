import { prisma } from "@/lib/prisma";

/** Call from future session checkout when a paid session is scheduled (Terms §5). */
export async function createBookedTrainingSession(args: {
  trainerId: string;
  clientId: string;
  scheduledStartAt: Date;
  trainerAmountCents: number;
}): Promise<{ id: string; confirmationDeadlineAt: Date }> {
  const confirmationDeadlineAt = new Date(args.scheduledStartAt);
  confirmationDeadlineAt.setHours(confirmationDeadlineAt.getHours() + 24);

  const row = await prisma.bookedTrainingSession.create({
    data: {
      trainerId: args.trainerId,
      clientId: args.clientId,
      scheduledStartAt: args.scheduledStartAt,
      confirmationDeadlineAt,
      trainerAmountCents: args.trainerAmountCents,
      status: "PENDING_CONFIRMATION",
    },
    select: { id: true, confirmationDeadlineAt: true },
  });
  return { id: row.id, confirmationDeadlineAt: row.confirmationDeadlineAt };
}
