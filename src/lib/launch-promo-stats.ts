import {
  betaMaxClients,
  betaMaxInPersonTrainers,
  betaMaxTotalTrainers,
  betaMaxVirtualTrainersBase,
  isBetaLaunchGatesEnabled,
} from "@/lib/beta-launch-config";
import { getTrainerBetaSlotSnapshot } from "@/lib/beta-trainer-slot-caps";
import { clientBetaSlotsUsed, trainerBetaSlotsUsed } from "@/lib/beta-waitlist-service";
import {
  countLaunchClients,
  countLaunchTrainers,
} from "@/lib/launch-account-counts";
import {
  getClientFoundingTrialMaxClients,
  getFoundingTrainerSalesBonusMaxSales,
  getFoundingTrainerSalesBonusMaxTrainers,
  getFoundingTrainerSalesBonusPercent,
  getTrainerFoundingBgPercentMax,
  isFoundingTrainerSalesBonusEligibleDate,
} from "@/lib/match-fit-launch-promotions";

export type LaunchPromoStats = {
  gatesEnabled: boolean;
  trainerCount: number;
  clientCount: number;
  trainerFoundingMax: number;
  clientFoundingMax: number;
  trainerFoundingRemaining: number;
  clientFoundingRemaining: number;
  trainerFoundingActive: boolean;
  clientFoundingActive: boolean;
  trainerBetaCap: number;
  clientBetaCap: number;
  trainerBetaSlotsUsed: number;
  clientBetaSlotsUsed: number;
  trainerBetaSlotsRemaining: number;
  clientBetaSlotsRemaining: number;
  /** All {betaMaxTotalTrainers} coach slots taken — blocks new trainer signups without invite. */
  trainerTotalCapFull: boolean;
  trainerVirtualSlotsUsed: number;
  trainerVirtualSlotsMax: number;
  trainerVirtualSlotsRemaining: number;
  trainerVirtualCapFull: boolean;
  trainerInPersonSlotsUsed: number;
  trainerInPersonSlotsMax: number;
  trainerInPersonSlotsRemaining: number;
  trainerInPersonCapFull: boolean;
  trainerVirtualBaseMax: number;
  /** True when virtual, in-person, or total bucket is full (waitlist accepts joins). */
  trainerWaitlistOpen: boolean;
  clientWaitlistOpen: boolean;
  /** Whether a new coach can opt in to in-person offerings (backend-enforced; UI-only hint). */
  inPersonOfferingAvailable: boolean;
  trainerSalesBonusMaxTrainers: number;
  trainerSalesBonusMaxSales: number;
  trainerSalesBonusPercent: number;
  trainerSalesBonusActive: boolean;
};

/** Single source for founding promo + beta cap counters (excludes test / synthetic accounts). */
export async function getLaunchPromoStats(): Promise<LaunchPromoStats> {
  const gatesEnabled = isBetaLaunchGatesEnabled();
  const trainerFoundingMax = getTrainerFoundingBgPercentMax();
  const clientFoundingMax = getClientFoundingTrialMaxClients();
  const trainerBetaCap = betaMaxTotalTrainers();
  const clientBetaCap = betaMaxClients();

  const [trainerCount, clientCount, trainerUsed, clientUsed, slotSnapshot] = await Promise.all([
    countLaunchTrainers(),
    countLaunchClients(),
    gatesEnabled ? trainerBetaSlotsUsed() : Promise.resolve(0),
    gatesEnabled ? clientBetaSlotsUsed() : Promise.resolve(0),
    gatesEnabled ? getTrainerBetaSlotSnapshot() : Promise.resolve(null),
  ]);

  const trainerFoundingRemaining = Math.max(0, trainerFoundingMax - trainerCount);
  const clientFoundingRemaining = Math.max(0, clientFoundingMax - clientCount);
  const trainerSalesBonusMaxTrainers = getFoundingTrainerSalesBonusMaxTrainers();
  const trainerVirtualBaseMax = betaMaxVirtualTrainersBase();
  const trainerInPersonSlotsMax = betaMaxInPersonTrainers();
  const trainerTotalCapFull = gatesEnabled && trainerUsed >= trainerBetaCap;
  const trainerVirtualCapFull = gatesEnabled && (slotSnapshot?.virtualRemaining ?? 1) <= 0;
  const trainerInPersonCapFull = gatesEnabled && (slotSnapshot?.inPersonRemaining ?? 1) <= 0;
  const trainerWaitlistOpen =
    gatesEnabled &&
    (trainerTotalCapFull || trainerVirtualCapFull || trainerInPersonCapFull);

  return {
    gatesEnabled,
    trainerCount,
    clientCount,
    trainerFoundingMax,
    clientFoundingMax,
    trainerFoundingRemaining,
    clientFoundingRemaining,
    trainerFoundingActive: trainerCount < trainerFoundingMax,
    clientFoundingActive: clientCount < clientFoundingMax,
    trainerBetaCap,
    clientBetaCap,
    trainerBetaSlotsUsed: trainerUsed,
    clientBetaSlotsUsed: clientUsed,
    trainerBetaSlotsRemaining: Math.max(0, trainerBetaCap - trainerUsed),
    clientBetaSlotsRemaining: Math.max(0, clientBetaCap - clientUsed),
    trainerTotalCapFull,
    trainerVirtualSlotsUsed: slotSnapshot?.virtualUsed ?? 0,
    trainerVirtualSlotsMax: slotSnapshot?.effectiveVirtualMax ?? trainerVirtualBaseMax,
    trainerVirtualSlotsRemaining: slotSnapshot?.virtualRemaining ?? trainerVirtualBaseMax,
    trainerVirtualCapFull,
    trainerInPersonSlotsUsed: slotSnapshot?.inPersonUsed ?? 0,
    trainerInPersonSlotsMax,
    trainerInPersonSlotsRemaining: slotSnapshot?.inPersonRemaining ?? trainerInPersonSlotsMax,
    trainerInPersonCapFull,
    trainerVirtualBaseMax,
    trainerWaitlistOpen,
    clientWaitlistOpen: gatesEnabled && clientUsed >= clientBetaCap,
    inPersonOfferingAvailable: !gatesEnabled || !trainerInPersonCapFull,
    trainerSalesBonusMaxTrainers,
    trainerSalesBonusMaxSales: getFoundingTrainerSalesBonusMaxSales(),
    trainerSalesBonusPercent: getFoundingTrainerSalesBonusPercent(),
    trainerSalesBonusActive:
      trainerCount < trainerSalesBonusMaxTrainers && isFoundingTrainerSalesBonusEligibleDate(new Date()),
  };
}
