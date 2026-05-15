import { prisma } from "@/lib/prisma";

export async function findTrainerByIdentifier(identifier: string) {
  const raw = identifier.trim();
  if (!raw) return null;
  return prisma.trainer.findFirst({
    where: {
      deidentifiedAt: null,
      OR: [{ username: raw }, { phone: raw }, { email: raw.toLowerCase() }],
    },
  });
}

export async function isTrainerUsernameTaken(username: string): Promise<boolean> {
  const u = username.trim();
  const existing = await prisma.trainer.findFirst({ where: { username: u, deidentifiedAt: null } });
  if (existing) return true;
  const now = new Date();
  const reserved = await prisma.betaTrainerWaitlistEntry.findFirst({
    where: {
      desiredUsername: u,
      status: "INVITED",
      slotExpiresAt: { gt: now },
    },
    select: { id: true },
  });
  return Boolean(reserved);
}

export async function isTrainerEmailTaken(email: string): Promise<boolean> {
  const e = email.trim().toLowerCase();
  const existing = await prisma.trainer.findFirst({ where: { email: e, deidentifiedAt: null } });
  if (existing) return true;
  const wl = await prisma.betaTrainerWaitlistEntry.findFirst({
    where: {
      email: e,
      status: "INVITED",
      slotExpiresAt: { gt: new Date() },
    },
    select: { id: true },
  });
  return Boolean(wl);
}

/** True if another trainer account already uses this username. */
export async function isTrainerUsernameTakenByAnother(username: string, excludeTrainerId: string): Promise<boolean> {
  const u = username.trim();
  const other = await prisma.trainer.findFirst({
    where: { username: u, deidentifiedAt: null, NOT: { id: excludeTrainerId } },
  });
  if (other) return true;
  const now = new Date();
  const reserved = await prisma.betaTrainerWaitlistEntry.findFirst({
    where: {
      desiredUsername: u,
      status: "INVITED",
      slotExpiresAt: { gt: now },
    },
    select: { id: true },
  });
  return Boolean(reserved);
}
