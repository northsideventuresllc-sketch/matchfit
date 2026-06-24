import { betaMaxClients, betaMaxTrainersAtlanta, betaMaxTrainersVirtual, isBetaLaunchGatesEnabled } from "@/lib/beta-launch-config";
import {
  atlantaTrainerBetaPoolSlotsUsed,
  virtualTrainerBetaPoolSlotsUsed,
} from "@/lib/beta-trainer-pool";
import {
  clientBetaSlotsUsed,
  trainerBetaSlotsUsed,
} from "@/lib/beta-waitlist-service";
import { ensureLaunchPromoSchema } from "@/lib/ensure-launch-promo-schema";
import {
  countLaunchClients,
  countLaunchTrainers,
} from "@/lib/launch-account-counts";
import {
  getClientFoundingTrialMaxClients,
  getTrainerFoundingBgPercentMax,
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
  trainerBetaCapAtlanta: number;
  trainerBetaCapVirtual: number;
  trainerBetaSlotsUsedAtlanta: number;
  trainerBetaSlotsUsedVirtual: number;
  trainerBetaSlotsRemainingAtlanta: number;
  trainerBetaSlotsRemainingVirtual: number;
  trainerWaitlistOpen: boolean;
  clientWaitlistOpen: boolean;
};

/** Single source for founding promo + beta cap counters (excludes test / synthetic accounts). */
export async function getLaunchPromoStats(): Promise<LaunchPromoStats> {
  await ensureLaunchPromoSchema().catch((e) => {
    console.error("[launch-promo-stats] ensureLaunchPromoSchema", e);
  });

  const gatesEnabled = isBetaLaunchGatesEnabled();
  const trainerFoundingMax = getTrainerFoundingBgPercentMax();
  const clientFoundingMax = getClientFoundingTrialMaxClients();
  const trainerBetaCapAtlanta = betaMaxTrainersAtlanta();
  const trainerBetaCapVirtual = betaMaxTrainersVirtual();
  const trainerBetaCap = trainerBetaCapAtlanta + trainerBetaCapVirtual;
  const clientBetaCap = betaMaxClients();

  const [trainerCount, clientCount, trainerUsed, clientUsed, atlantaUsed, virtualUsed] = await Promise.all([
    countLaunchTrainers(),
    countLaunchClients(),
    gatesEnabled ? trainerBetaSlotsUsed() : Promise.resolve(0),
    gatesEnabled ? clientBetaSlotsUsed() : Promise.resolve(0),
    gatesEnabled ? atlantaTrainerBetaPoolSlotsUsed() : Promise.resolve(0),
    gatesEnabled ? virtualTrainerBetaPoolSlotsUsed() : Promise.resolve(0),
  ]);

  const trainerFoundingRemaining = Math.max(0, trainerFoundingMax - trainerCount);
  const clientFoundingRemaining = Math.max(0, clientFoundingMax - clientCount);

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
    trainerBetaCapAtlanta,
    trainerBetaCapVirtual,
    trainerBetaSlotsUsedAtlanta: atlantaUsed,
    trainerBetaSlotsUsedVirtual: virtualUsed,
    trainerBetaSlotsRemainingAtlanta: Math.max(0, trainerBetaCapAtlanta - atlantaUsed),
    trainerBetaSlotsRemainingVirtual: Math.max(0, trainerBetaCapVirtual - virtualUsed),
    trainerWaitlistOpen: gatesEnabled && trainerUsed >= trainerBetaCap,
    clientWaitlistOpen: gatesEnabled && clientUsed >= clientBetaCap,
  };
}
