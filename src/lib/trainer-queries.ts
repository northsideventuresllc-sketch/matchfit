import { prisma } from "@/lib/prisma";

export async function findTrainerByIdentifier(identifier: string) {
  const raw = identifier.trim();
  if (!raw) return null;
  return prisma.trainer.findFirst({
    where: {
      OR: [{ username: raw }, { phone: raw }, { email: raw.toLowerCase() }],
    },
  });
}

export async function isTrainerUsernameTaken(username: string): Promise<boolean> {
  const u = username.trim();
  const existing = await prisma.trainer.findUnique({ where: { username: u } });
  return Boolean(existing);
}

export async function isTrainerEmailTaken(email: string): Promise<boolean> {
  const e = email.trim().toLowerCase();
  const existing = await prisma.trainer.findUnique({ where: { email: e } });
  return Boolean(existing);
}

/** True if another trainer account already uses this username. */
export async function isTrainerUsernameTakenByAnother(username: string, excludeTrainerId: string): Promise<boolean> {
  const u = username.trim();
  const other = await prisma.trainer.findFirst({
    where: { username: u, NOT: { id: excludeTrainerId } },
  });
  return Boolean(other);
}
