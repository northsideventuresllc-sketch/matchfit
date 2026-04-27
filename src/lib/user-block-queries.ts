import { prisma } from "@/lib/prisma";

export async function isTrainerClientPairBlocked(trainerId: string, clientId: string): Promise<boolean> {
  const n = await prisma.userBlock.count({
    where: {
      OR: [
        {
          blockerIsTrainer: true,
          blockerId: trainerId,
          blockedIsTrainer: false,
          blockedId: clientId,
        },
        {
          blockerIsTrainer: false,
          blockerId: clientId,
          blockedIsTrainer: true,
          blockedId: trainerId,
        },
      ],
    },
  });
  return n > 0;
}
