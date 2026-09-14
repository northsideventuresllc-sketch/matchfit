import { betaMaxClients, betaMaxTrainers, isBetaLaunchGatesEnabled } from "@/lib/beta-launch-config";
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
  /** False when countLaunchTrainers kept failing (DB/pooler blip) — trainerCount is a 0 placeholder, not a real count. */
  trainerCountAvailable: boolean;
  /** False when countLaunchClients kept failing (DB/pooler blip) — clientCount is a 0 placeholder, not a real count. */
  clientCountAvailable: boolean;
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
  /** False when trainerBetaSlotsUsed kept failing — trainerBetaSlotsUsed is a 0 placeholder, not a real count. */
  trainerBetaSlotsAvailable: boolean;
  /** False when clientBetaSlotsUsed kept failing — clientBetaSlotsUsed is a 0 placeholder, not a real count. */
  clientBetaSlotsAvailable: boolean;
  trainerBetaSlotsRemaining: number;
  clientBetaSlotsRemaining: number;
  trainerWaitlistOpen: boolean;
  clientWaitlistOpen: boolean;
};

/**
 * The Match Fit Supabase pooler has intermittent circuit-breaker windows (confirmed live
 * 2026-09-12..14 via Supavisor logs: "failed to retrieve database credentials", recurring every
 * few hours) that make a single prisma.count() throw even though the DB itself is fine seconds
 * later. Retrying inside the same request absorbs most of these blips instead of immediately
 * falling back to a fake 0 — see the JB report this fixes: "the beta counter reset" was actually
 * a real count failing mid-blip and silently rendering as 0/N (added by #390), not a real reset.
 */
async function withTransientRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      if (attempt < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
      }
    }
  }
  throw lastError;
}

type CountOutcome = { count: number; available: boolean };

async function countOrUnavailable(label: string, fn: () => Promise<number>): Promise<CountOutcome> {
  try {
    const count = await withTransientRetry(fn);
    return { count, available: true };
  } catch (e) {
    console.error(`[launch-promo-stats] ${label} failed after retries`, e);
    return { count: 0, available: false };
  }
}

/** Single source for founding promo + beta cap counters (excludes test / synthetic accounts). */
export async function getLaunchPromoStats(): Promise<LaunchPromoStats> {
  await ensureLaunchPromoSchema().catch((e) => {
    console.error("[launch-promo-stats] ensureLaunchPromoSchema", e);
  });

  const gatesEnabled = isBetaLaunchGatesEnabled();
  const trainerFoundingMax = getTrainerFoundingBgPercentMax();
  const clientFoundingMax = getClientFoundingTrialMaxClients();
  const trainerBetaCap = betaMaxTrainers();
  const clientBetaCap = betaMaxClients();

  const [trainerCountResult, clientCountResult, trainerUsedResult, clientUsedResult] = await Promise.all([
    countOrUnavailable("countLaunchTrainers", countLaunchTrainers),
    countOrUnavailable("countLaunchClients", countLaunchClients),
    gatesEnabled
      ? countOrUnavailable("trainerBetaSlotsUsed", trainerBetaSlotsUsed)
      : Promise.resolve<CountOutcome>({ count: 0, available: true }),
    gatesEnabled
      ? countOrUnavailable("clientBetaSlotsUsed", clientBetaSlotsUsed)
      : Promise.resolve<CountOutcome>({ count: 0, available: true }),
  ]);

  const trainerCount = trainerCountResult.count;
  const clientCount = clientCountResult.count;
  const trainerUsed = trainerUsedResult.count;
  const clientUsed = clientUsedResult.count;

  const trainerFoundingRemaining = Math.max(0, trainerFoundingMax - trainerCount);
  const clientFoundingRemaining = Math.max(0, clientFoundingMax - clientCount);

  return {
    gatesEnabled,
    trainerCount,
    clientCount,
    trainerCountAvailable: trainerCountResult.available,
    clientCountAvailable: clientCountResult.available,
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
    trainerBetaSlotsAvailable: trainerUsedResult.available,
    clientBetaSlotsAvailable: clientUsedResult.available,
    trainerBetaSlotsRemaining: Math.max(0, trainerBetaCap - trainerUsed),
    clientBetaSlotsRemaining: Math.max(0, clientBetaCap - clientUsed),
    trainerWaitlistOpen: gatesEnabled && trainerUsed >= trainerBetaCap,
    clientWaitlistOpen: gatesEnabled && clientUsed >= clientBetaCap,
  };
}
