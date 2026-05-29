import type { Prisma } from "@/generated/prisma/client";
import {
  betaMaxInPersonTrainers,
  betaMaxTotalTrainers,
  betaMaxVirtualTrainersBase,
} from "@/lib/beta-launch-config";
import { launchTrainerCountWhere } from "@/lib/launch-account-counts";
import { prisma } from "@/lib/prisma";

type BetaCapDb = Prisma.TransactionClient | typeof prisma;

export type TrainerBetaOfferingPrefs = {
  wantsVirtual: boolean;
  wantsInPerson: boolean;
};

export type TrainerBetaSlotSnapshot = {
  totalUsed: number;
  virtualUsed: number;
  inPersonUsed: number;
  totalMax: number;
  inPersonMax: number;
  effectiveVirtualMax: number;
  totalRemaining: number;
  virtualRemaining: number;
  inPersonRemaining: number;
};

/** Valid US postal code for virtual trainer service area (nationwide beta expansion). */
export function isValidUsTrainerServiceZip(zip: string): boolean {
  return /^\d{5}(-\d{4})?$/.test(zip.trim());
}

/**
 * Unused in-person capacity reallocates to virtual one slot at a time once the base 20 virtual seats fill.
 * Example: 20 virtual + 0 in-person → cap 21; 21 virtual + 0 in-person → cap 22; … up to 30 total.
 */
export function computeEffectiveVirtualMax(virtualUsed: number, inPersonUsed: number): number {
  const inPersonMax = betaMaxInPersonTrainers();
  const virtualBase = betaMaxVirtualTrainersBase();
  const totalMax = betaMaxTotalTrainers();
  const virtualOverflow = Math.max(0, virtualUsed - (virtualBase - 1));
  const unusedInPerson = Math.max(0, inPersonMax - Math.max(0, inPersonUsed));
  const reallocated = Math.min(unusedInPerson, virtualOverflow);
  return Math.min(totalMax, virtualBase + reallocated);
}

export function buildTrainerBetaSlotSnapshot(args: {
  totalUsed: number;
  virtualUsed: number;
  inPersonUsed: number;
}): TrainerBetaSlotSnapshot {
  const totalMax = betaMaxTotalTrainers();
  const inPersonMax = betaMaxInPersonTrainers();
  const effectiveVirtualMax = computeEffectiveVirtualMax(args.virtualUsed, args.inPersonUsed);
  return {
    totalUsed: args.totalUsed,
    virtualUsed: args.virtualUsed,
    inPersonUsed: args.inPersonUsed,
    totalMax,
    inPersonMax,
    effectiveVirtualMax,
    totalRemaining: Math.max(0, totalMax - args.totalUsed),
    virtualRemaining: Math.max(0, effectiveVirtualMax - args.virtualUsed),
    inPersonRemaining: Math.max(0, inPersonMax - args.inPersonUsed),
  };
}

function trainerRegisteredVirtualWhere(): Prisma.TrainerWhereInput {
  return {
    ...launchTrainerCountWhere(),
    profile: { is: { betaSlotVirtualHeld: true } },
  };
}

function trainerRegisteredInPersonWhere(): Prisma.TrainerWhereInput {
  return {
    ...launchTrainerCountWhere(),
    profile: { is: { betaSlotInPersonHeld: true } },
  };
}

async function countRegisteredVirtualSlots(db: BetaCapDb): Promise<number> {
  return db.trainer.count({ where: trainerRegisteredVirtualWhere() });
}

async function countRegisteredInPersonSlots(db: BetaCapDb): Promise<number> {
  return db.trainer.count({ where: trainerRegisteredInPersonWhere() });
}

async function countRegisteredTotalTrainers(db: BetaCapDb): Promise<number> {
  return db.trainer.count({ where: launchTrainerCountWhere() });
}

async function countInviteVirtualSlots(db: BetaCapDb): Promise<number> {
  return db.betaTrainerWaitlistEntry.count({
    where: {
      status: "INVITED",
      slotExpiresAt: { gt: new Date() },
      desiredOfferingVirtual: true,
    },
  });
}

async function countInviteInPersonSlots(db: BetaCapDb): Promise<number> {
  return db.betaTrainerWaitlistEntry.count({
    where: {
      status: "INVITED",
      slotExpiresAt: { gt: new Date() },
      desiredOfferingInPerson: true,
    },
  });
}

async function countInviteTotalSlots(db: BetaCapDb): Promise<number> {
  return db.betaTrainerWaitlistEntry.count({
    where: { status: "INVITED", slotExpiresAt: { gt: new Date() } },
  });
}

export async function getTrainerBetaSlotSnapshot(db: BetaCapDb = prisma): Promise<TrainerBetaSlotSnapshot> {
  const [totalRegistered, virtualRegistered, inPersonRegistered, totalInvited, virtualInvited, inPersonInvited] =
    await Promise.all([
      countRegisteredTotalTrainers(db),
      countRegisteredVirtualSlots(db),
      countRegisteredInPersonSlots(db),
      countInviteTotalSlots(db),
      countInviteVirtualSlots(db),
      countInviteInPersonSlots(db),
    ]);
  return buildTrainerBetaSlotSnapshot({
    totalUsed: totalRegistered + totalInvited,
    virtualUsed: virtualRegistered + virtualInvited,
    inPersonUsed: inPersonRegistered + inPersonInvited,
  });
}

export function trainerOfferingPrefsFromSignup(args: {
  wantsVirtual?: boolean;
  wantsInPerson?: boolean;
}): TrainerBetaOfferingPrefs {
  const wantsInPerson = args.wantsInPerson === true;
  return {
    wantsVirtual: wantsInPerson ? true : args.wantsVirtual !== false,
    wantsInPerson,
  };
}

export function canReserveTrainerBetaSlots(
  snapshot: TrainerBetaSlotSnapshot,
  prefs: TrainerBetaOfferingPrefs,
): { ok: true } | { ok: false; reason: "total" | "virtual" | "in_person" | "none" } {
  if (!prefs.wantsVirtual && !prefs.wantsInPerson) {
    return { ok: false, reason: "none" };
  }
  if (snapshot.totalRemaining <= 0) {
    return { ok: false, reason: "total" };
  }
  if (prefs.wantsVirtual && snapshot.virtualRemaining <= 0) {
    return { ok: false, reason: "virtual" };
  }
  if (prefs.wantsInPerson && snapshot.inPersonRemaining <= 0) {
    return { ok: false, reason: "in_person" };
  }
  return { ok: true };
}

export function trainerBetaSlotPrefsFromWaitlistEntry(entry: {
  desiredOfferingVirtual: boolean;
  desiredOfferingInPerson: boolean;
}): TrainerBetaOfferingPrefs {
  return {
    wantsVirtual: entry.desiredOfferingVirtual,
    wantsInPerson: entry.desiredOfferingInPerson,
  };
}
