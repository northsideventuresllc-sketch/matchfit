import { betaMaxTrainers, isBetaLaunchGatesEnabled } from "@/lib/beta-launch-config";
import { launchTrainerCountWhere } from "@/lib/launch-account-counts";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";

/**
 * Beta trainer capacity, worldwide.
 *
 * Match Fit went worldwide (JB decision, 2026-07-31). Removed 2026-08-04 under
 * ticket MF-ATLANTA-GATES-AFTER-WORLDWIDE (geo-guard:allow): the two-pool split.
 * geo-guard:allow
 * A coach's postal code used to decide which cap they consumed, which made one US
 * metro the default and every other place on earth the overflow bucket. There is
 * now one beta trainer cap and it is geography-blind.
 *
 * Historic rows keep their stored `invitedBetaPool` / `virtualOnlyBetaSlot` values;
 * nothing is deleted. Those values are simply no longer derived from location.
 */

type BetaPoolDb = Prisma.TransactionClient | PrismaClient;

export const TRAINER_VIRTUAL_ONLY_BETA_SLOT_MESSAGE =
  "Your beta slot is virtual-only. Publish virtual or DIY packages for now, or join the waitlist for an in-person founding slot.";

async function launchTrainerPoolRows(db: BetaPoolDb) {
  return db.trainer.findMany({
    where: launchTrainerCountWhere(),
    select: {
      profile: {
        select: {
          virtualOnlyBetaSlot: true,
        },
      },
    },
  });
}

export async function countBetaPoolTrainers(db: BetaPoolDb): Promise<number> {
  const rows = await launchTrainerPoolRows(db);
  return rows.length;
}

export async function countActiveTrainerBetaInvites(db: BetaPoolDb): Promise<number> {
  return db.betaTrainerWaitlistEntry.count({
    where: {
      status: "INVITED",
      slotExpiresAt: { gt: new Date() },
    },
  });
}

export async function trainerBetaPoolSlotsUsed(db?: BetaPoolDb): Promise<number> {
  const { prisma } = await import("@/lib/prisma");
  const client = db ?? prisma;
  return trainerBetaPoolSlotsUsedInTx(client);
}

export async function trainerBetaPoolSlotsUsedInTx(tx: BetaPoolDb): Promise<number> {
  const [registered, invited] = await Promise.all([
    countBetaPoolTrainers(tx),
    countActiveTrainerBetaInvites(tx),
  ]);
  return registered + invited;
}

export type TrainerSignupPoolAssignment = {
  virtualOnlyBetaSlot: boolean;
};

/** Capacity check only — no location input, no location output. */
export function resolveTrainerSignupPoolAssignment(args: {
  slotsUsed: number;
}): TrainerSignupPoolAssignment | null {
  if (args.slotsUsed >= betaMaxTrainers()) return null;
  return { virtualOnlyBetaSlot: false };
}

export async function getTrainerSignupPoolAssignment(): Promise<TrainerSignupPoolAssignment | null> {
  const slotsUsed = await trainerBetaPoolSlotsUsed();
  return resolveTrainerSignupPoolAssignment({ slotsUsed });
}

export async function isTrainerBetaFullyCapped(): Promise<boolean> {
  if (!isBetaLaunchGatesEnabled()) return false;
  return (await trainerBetaPoolSlotsUsed()) >= betaMaxTrainers();
}

/** True when a waitlist invite can still be issued. */
export async function canIssueTrainerWaitlistInvite(): Promise<boolean> {
  return (await trainerBetaPoolSlotsUsed()) < betaMaxTrainers();
}

export function trainerDeliveryBlockedByVirtualOnlyBetaSlot(args: {
  virtualOnlyBetaSlot: boolean | null | undefined;
  delivery: "virtual" | "in_person" | "both";
}): boolean {
  if (!args.virtualOnlyBetaSlot) return false;
  return args.delivery === "in_person" || args.delivery === "both";
}
