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
 * Supavisor's circuit breaker (`ECIRCUITBREAKER` / "too many authentication failures, new
 * connections are temporarily blocked") rejects fast and stays open for the duration of a
 * sustained pooler outage — confirmed live 2026-09-14 via Vercel production runtime logs, all 4
 * `getLaunchPromoStats()` count queries hitting it on every request observed. Retrying into an
 * open breaker cannot succeed until the breaker itself clears, so it's not a transient blip worth
 * spending an attempt on — treat it as a hard stop instead.
 */
function isCircuitBreakerError(e: unknown): boolean {
  const message = e instanceof Error ? `${e.name} ${e.message}` : String(e);
  return /ECIRCUITBREAKER|too many authentication failures/i.test(message);
}

class QueryTimeoutError extends Error {
  constructor(ms: number) {
    super(`query timed out after ${ms}ms`);
    this.name = "QueryTimeoutError";
  }
}

/**
 * Races `fn()` against a hard timeout. `pg`'s own `connectionTimeoutMillis` defaults to 0 (wait
 * forever) and this pool doesn't override it (see `pgPoolConfigForConnectionString`), so without
 * this a single stuck connection attempt can hold a request open indefinitely — this is the only
 * ceiling in the stack. Doesn't cancel `promise` itself (Prisma gives no cancellation handle),
 * only stops waiting on it — safe because the eventual real settlement is still consumed below,
 * so nothing becomes an unhandled rejection.
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new QueryTimeoutError(ms)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * Per-attempt hard ceiling and total wall-clock budget for one query's whole retry chain —
 * bounds `/promos` and `/api/public/beta-launch-status` to a few seconds even during a sustained
 * outage, instead of the ~60s a full 4-query × 3-attempt retry chain produced on 2026-09-14 when
 * every attempt ran into an open circuit breaker (see JB report this fixes: "/promos taking
 * close to a minute to load"). Four queries still run in parallel (`Promise.all` below), so the
 * whole request is bounded by this same budget, not 4x it.
 */
const TRANSIENT_RETRY_ATTEMPT_TIMEOUT_MS = 2_500;
const TRANSIENT_RETRY_TOTAL_BUDGET_MS = 4_000;

/**
 * Retries a genuinely transient blip (a few hundred ms — pooler hiccup, brief network drop) so
 * the real count still renders instead of the old bug where one failed query silently rendered
 * as a fake 0 (see the JB report #390/#391 fixed: "the beta counter reset"). Does NOT retry into
 * an open circuit breaker (`isCircuitBreakerError`, futile — fails fast instead) and never runs
 * longer than `TRANSIENT_RETRY_TOTAL_BUDGET_MS` in total, regardless of how many attempts or
 * what kind of failure — the hard ceiling this hotfix adds so a sustained outage can never again
 * hold a request open for anywhere near a minute.
 */
async function withTransientRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  const deadline = Date.now() + TRANSIENT_RETRY_TOTAL_BUDGET_MS;
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    try {
      return await withTimeout(fn(), Math.min(TRANSIENT_RETRY_ATTEMPT_TIMEOUT_MS, remaining));
    } catch (e) {
      lastError = e;
      if (isCircuitBreakerError(e)) break; // breaker is open — further attempts are futile
      const isLastAttempt = attempt === attempts - 1;
      const backoff = 300 * (attempt + 1);
      if (isLastAttempt || Date.now() + backoff >= deadline) break;
      await new Promise((resolve) => setTimeout(resolve, backoff));
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
