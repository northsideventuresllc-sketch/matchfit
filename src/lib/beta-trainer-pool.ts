import { isZipInBetaAtlantaMetroArea } from "@/lib/beta-atlanta-metro-zips";
import {
  betaMaxTrainersAtlanta,
  betaMaxTrainersVirtual,
  isBetaLaunchGatesEnabled,
} from "@/lib/beta-launch-config";
import { launchTrainerCountWhere } from "@/lib/launch-account-counts";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";

export type TrainerBetaPool = "atlanta" | "virtual";

type BetaPoolDb = Prisma.TransactionClient | PrismaClient;

export const TRAINER_VIRTUAL_ONLY_BETA_SLOT_MESSAGE =
  "Your beta slot is virtual-only because Atlanta in-person coach slots are full. Publish virtual or DIY packages for now, or join the waitlist for an in-person founding slot.";

export function trainerPrimaryPoolForZip(serviceZipCode: string): TrainerBetaPool {
  return isZipInBetaAtlantaMetroArea(serviceZipCode) ? "atlanta" : "virtual";
}

export function inferInvitedBetaPoolFromWaitlistZip(serviceZipCode: string): TrainerBetaPool {
  return trainerPrimaryPoolForZip(serviceZipCode);
}

export function trainerOccupiesAtlantaBetaPool(args: {
  serviceZipCode: string | null | undefined;
  virtualOnlyBetaSlot: boolean | null | undefined;
}): boolean {
  const zip = args.serviceZipCode?.trim() ?? "";
  if (!zip || !isZipInBetaAtlantaMetroArea(zip)) return false;
  return !args.virtualOnlyBetaSlot;
}

export function trainerOccupiesVirtualBetaPool(args: {
  serviceZipCode: string | null | undefined;
  virtualOnlyBetaSlot: boolean | null | undefined;
}): boolean {
  const zip = args.serviceZipCode?.trim() ?? "";
  if (!zip) return true;
  if (!isZipInBetaAtlantaMetroArea(zip)) return true;
  return Boolean(args.virtualOnlyBetaSlot);
}

async function launchTrainerPoolRows(db: BetaPoolDb) {
  return db.trainer.findMany({
    where: launchTrainerCountWhere(),
    select: {
      profile: {
        select: {
          serviceZipCode: true,
          virtualOnlyBetaSlot: true,
        },
      },
    },
  });
}

export async function countAtlantaPoolTrainers(db: BetaPoolDb): Promise<number> {
  const rows = await launchTrainerPoolRows(db);
  return rows.filter((r) =>
    trainerOccupiesAtlantaBetaPool({
      serviceZipCode: r.profile?.serviceZipCode,
      virtualOnlyBetaSlot: r.profile?.virtualOnlyBetaSlot,
    }),
  ).length;
}

export async function countVirtualPoolTrainers(db: BetaPoolDb): Promise<number> {
  const rows = await launchTrainerPoolRows(db);
  return rows.filter((r) =>
    trainerOccupiesVirtualBetaPool({
      serviceZipCode: r.profile?.serviceZipCode,
      virtualOnlyBetaSlot: r.profile?.virtualOnlyBetaSlot,
    }),
  ).length;
}

export async function countActiveAtlantaPoolBetaInvites(db: BetaPoolDb): Promise<number> {
  return db.betaTrainerWaitlistEntry.count({
    where: {
      status: "INVITED",
      slotExpiresAt: { gt: new Date() },
      invitedBetaPool: "atlanta",
    },
  });
}

export async function countActiveVirtualPoolBetaInvites(db: BetaPoolDb): Promise<number> {
  return db.betaTrainerWaitlistEntry.count({
    where: {
      status: "INVITED",
      slotExpiresAt: { gt: new Date() },
      invitedBetaPool: "virtual",
    },
  });
}

export async function countActiveLegacyTrainerBetaInvitesByPool(
  db: BetaPoolDb,
): Promise<{ atlanta: number; virtual: number }> {
  const legacy = await db.betaTrainerWaitlistEntry.findMany({
    where: {
      status: "INVITED",
      slotExpiresAt: { gt: new Date() },
      invitedBetaPool: null,
    },
    select: { serviceZipCode: true },
  });
  let atlanta = 0;
  let virtual = 0;
  for (const row of legacy) {
    if (trainerPrimaryPoolForZip(row.serviceZipCode) === "atlanta") atlanta += 1;
    else virtual += 1;
  }
  return { atlanta, virtual };
}

export async function atlantaTrainerBetaPoolSlotsUsed(db?: BetaPoolDb): Promise<number> {
  const { prisma } = await import("@/lib/prisma");
  const client = db ?? prisma;
  const [registered, invited, legacy] = await Promise.all([
    countAtlantaPoolTrainers(client),
    countActiveAtlantaPoolBetaInvites(client),
    countActiveLegacyTrainerBetaInvitesByPool(client),
  ]);
  return registered + invited + legacy.atlanta;
}

export async function virtualTrainerBetaPoolSlotsUsed(db?: BetaPoolDb): Promise<number> {
  const { prisma } = await import("@/lib/prisma");
  const client = db ?? prisma;
  const [registered, invited, legacy] = await Promise.all([
    countVirtualPoolTrainers(client),
    countActiveVirtualPoolBetaInvites(client),
    countActiveLegacyTrainerBetaInvitesByPool(client),
  ]);
  return registered + invited + legacy.virtual;
}

export async function atlantaTrainerBetaPoolSlotsUsedInTx(tx: BetaPoolDb): Promise<number> {
  const [registered, invited, legacy] = await Promise.all([
    countAtlantaPoolTrainers(tx),
    countActiveAtlantaPoolBetaInvites(tx),
    countActiveLegacyTrainerBetaInvitesByPool(tx),
  ]);
  return registered + invited + legacy.atlanta;
}

export async function virtualTrainerBetaPoolSlotsUsedInTx(tx: BetaPoolDb): Promise<number> {
  const [registered, invited, legacy] = await Promise.all([
    countVirtualPoolTrainers(tx),
    countActiveVirtualPoolBetaInvites(tx),
    countActiveLegacyTrainerBetaInvitesByPool(tx),
  ]);
  return registered + invited + legacy.virtual;
}

export type TrainerSignupPoolAssignment = {
  pool: TrainerBetaPool;
  virtualOnlyBetaSlot: boolean;
};

export function resolveTrainerSignupPoolAssignment(serviceZipCode: string, args: {
  atlantaUsed: number;
  virtualUsed: number;
}): TrainerSignupPoolAssignment | null {
  const primary = trainerPrimaryPoolForZip(serviceZipCode);
  const atlantaMax = betaMaxTrainersAtlanta();
  const virtualMax = betaMaxTrainersVirtual();

  if (primary === "virtual") {
    if (args.virtualUsed >= virtualMax) return null;
    return { pool: "virtual", virtualOnlyBetaSlot: false };
  }

  if (args.atlantaUsed < atlantaMax) {
    return { pool: "atlanta", virtualOnlyBetaSlot: false };
  }
  if (args.virtualUsed < virtualMax) {
    return { pool: "virtual", virtualOnlyBetaSlot: true };
  }
  return null;
}

export async function getTrainerSignupPoolAssignment(serviceZipCode: string): Promise<TrainerSignupPoolAssignment | null> {
  const [atlantaUsed, virtualUsed] = await Promise.all([
    atlantaTrainerBetaPoolSlotsUsed(),
    virtualTrainerBetaPoolSlotsUsed(),
  ]);
  return resolveTrainerSignupPoolAssignment(serviceZipCode, { atlantaUsed, virtualUsed });
}

export async function isTrainerBetaFullyCapped(): Promise<boolean> {
  if (!isBetaLaunchGatesEnabled()) return false;
  const [atlantaUsed, virtualUsed] = await Promise.all([
    atlantaTrainerBetaPoolSlotsUsed(),
    virtualTrainerBetaPoolSlotsUsed(),
  ]);
  return atlantaUsed >= betaMaxTrainersAtlanta() && virtualUsed >= betaMaxTrainersVirtual();
}

export async function resolveWaitlistInvitePool(serviceZipCode: string): Promise<TrainerBetaPool | null> {
  const primary = trainerPrimaryPoolForZip(serviceZipCode);
  const [atlantaUsed, virtualUsed] = await Promise.all([
    atlantaTrainerBetaPoolSlotsUsed(),
    virtualTrainerBetaPoolSlotsUsed(),
  ]);
  const atlantaMax = betaMaxTrainersAtlanta();
  const virtualMax = betaMaxTrainersVirtual();

  if (primary === "virtual") {
    return virtualUsed < virtualMax ? "virtual" : null;
  }
  if (atlantaUsed < atlantaMax) return "atlanta";
  if (virtualUsed < virtualMax) return "virtual";
  return null;
}

export function trainerDeliveryBlockedByVirtualOnlyBetaSlot(args: {
  virtualOnlyBetaSlot: boolean | null | undefined;
  delivery: "virtual" | "in_person" | "both";
}): boolean {
  if (!args.virtualOnlyBetaSlot) return false;
  return args.delivery === "in_person" || args.delivery === "both";
}
