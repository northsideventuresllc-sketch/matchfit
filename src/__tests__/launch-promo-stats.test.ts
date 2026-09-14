import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  countLaunchClientsMock,
  countLaunchTrainersMock,
  clientBetaSlotsUsedMock,
  trainerBetaSlotsUsedMock,
  isBetaLaunchGatesEnabledMock,
  betaMaxClientsMock,
  betaMaxTrainersMock,
  getTrainerFoundingBgPercentMaxMock,
  getClientFoundingTrialMaxClientsMock,
} = vi.hoisted(() => ({
  countLaunchClientsMock: vi.fn(),
  countLaunchTrainersMock: vi.fn(),
  clientBetaSlotsUsedMock: vi.fn(),
  trainerBetaSlotsUsedMock: vi.fn(),
  isBetaLaunchGatesEnabledMock: vi.fn(),
  betaMaxClientsMock: vi.fn(),
  betaMaxTrainersMock: vi.fn(),
  getTrainerFoundingBgPercentMaxMock: vi.fn(),
  getClientFoundingTrialMaxClientsMock: vi.fn(),
}));

vi.mock("@/lib/launch-account-counts", () => ({
  countLaunchClients: countLaunchClientsMock,
  countLaunchTrainers: countLaunchTrainersMock,
}));

vi.mock("@/lib/beta-waitlist-service", () => ({
  clientBetaSlotsUsed: clientBetaSlotsUsedMock,
  trainerBetaSlotsUsed: trainerBetaSlotsUsedMock,
}));

vi.mock("@/lib/beta-launch-config", () => ({
  betaMaxClients: betaMaxClientsMock,
  betaMaxTrainers: betaMaxTrainersMock,
  isBetaLaunchGatesEnabled: isBetaLaunchGatesEnabledMock,
}));

vi.mock("@/lib/match-fit-launch-promotions", () => ({
  getTrainerFoundingBgPercentMax: getTrainerFoundingBgPercentMaxMock,
  getClientFoundingTrialMaxClients: getClientFoundingTrialMaxClientsMock,
}));

import { getLaunchPromoStats } from "@/lib/launch-promo-stats";

describe("getLaunchPromoStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isBetaLaunchGatesEnabledMock.mockReturnValue(true);
    betaMaxTrainersMock.mockReturnValue(30);
    betaMaxClientsMock.mockReturnValue(50);
    getTrainerFoundingBgPercentMaxMock.mockReturnValue(30);
    getClientFoundingTrialMaxClientsMock.mockReturnValue(150);
    countLaunchTrainersMock.mockResolvedValue(2);
    countLaunchClientsMock.mockResolvedValue(12);
    trainerBetaSlotsUsedMock.mockResolvedValue(3);
    clientBetaSlotsUsedMock.mockResolvedValue(4);
  });

  it("derives founding remaining from launch counts (excludes test accounts at source)", async () => {
    const stats = await getLaunchPromoStats();

    expect(stats.trainerCount).toBe(2);
    expect(stats.clientCount).toBe(12);
    expect(stats.trainerFoundingRemaining).toBe(28);
    expect(stats.clientFoundingRemaining).toBe(138);
    expect(stats.trainerFoundingActive).toBe(true);
    expect(stats.clientFoundingActive).toBe(true);
  });

  // MF-ATLANTA-GATES-AFTER-WORLDWIDE (2026-08-04): one worldwide trainer cap.
  it("reports a single geography-free trainer cap", async () => {
    const stats = await getLaunchPromoStats();

    expect(stats.trainerBetaCap).toBe(30);
    expect(Object.keys(stats).some((k) => /atlanta/i.test(k))).toBe(false);
  });

  it("skips beta slot usage when gates are disabled", async () => {
    isBetaLaunchGatesEnabledMock.mockReturnValueOnce(false);

    const stats = await getLaunchPromoStats();

    expect(stats.gatesEnabled).toBe(false);
    expect(stats.trainerBetaSlotsUsed).toBe(0);
    expect(stats.clientBetaSlotsUsed).toBe(0);
    expect(stats.trainerWaitlistOpen).toBe(false);
    expect(stats.clientWaitlistOpen).toBe(false);
    expect(trainerBetaSlotsUsedMock).not.toHaveBeenCalled();
    expect(clientBetaSlotsUsedMock).not.toHaveBeenCalled();
  });

  it("marks waitlist open when beta slots used meets cap", async () => {
    betaMaxClientsMock.mockReturnValueOnce(4);
    clientBetaSlotsUsedMock.mockResolvedValueOnce(4);

    const stats = await getLaunchPromoStats();

    expect(stats.clientWaitlistOpen).toBe(true);
    expect(stats.clientBetaSlotsRemaining).toBe(0);
  });

  // Regression coverage for the JB report this fixes: "the beta counter reset" turned out to be a
  // transient DB/pooler blip that a prior fix (#390) silently rendered as a real "0" instead of
  // retrying or flagging it as unavailable — see launch-promo-stats.ts's withTransientRetry.
  describe("transient count failures", () => {
    it("retries a failing count and still reports the real value once it succeeds", async () => {
      countLaunchTrainersMock
        .mockRejectedValueOnce(new Error("pooler blip"))
        .mockRejectedValueOnce(new Error("pooler blip"))
        .mockResolvedValueOnce(9);

      const stats = await getLaunchPromoStats();

      expect(stats.trainerCount).toBe(9);
      expect(stats.trainerCountAvailable).toBe(true);
      expect(countLaunchTrainersMock).toHaveBeenCalledTimes(3);
    });

    it("marks the count unavailable (not a fake 0) once retries are exhausted", async () => {
      countLaunchClientsMock.mockRejectedValue(new Error("pooler still down"));

      const stats = await getLaunchPromoStats();

      expect(stats.clientCount).toBe(0);
      expect(stats.clientCountAvailable).toBe(false);
      // The other, independently-fetched counters are unaffected by one query's failure.
      expect(stats.trainerCount).toBe(2);
      expect(stats.trainerCountAvailable).toBe(true);
    });

    it("marks beta-slots-used unavailable the same way, independent of the founding count", async () => {
      trainerBetaSlotsUsedMock.mockRejectedValue(new Error("pooler still down"));

      const stats = await getLaunchPromoStats();

      expect(stats.trainerBetaSlotsUsed).toBe(0);
      expect(stats.trainerBetaSlotsAvailable).toBe(false);
      expect(stats.trainerWaitlistOpen).toBe(false);
    });
  });

  // Regression coverage for the JB report this fixes: "/promos taking close to a minute to
  // load" during a sustained Supabase pooler circuit-breaker outage — see launch-promo-stats.ts's
  // isCircuitBreakerError / withTimeout / TRANSIENT_RETRY_TOTAL_BUDGET_MS.
  describe("sustained outage (circuit breaker) does not stack latency", () => {
    it("stops retrying immediately on an ECIRCUITBREAKER-class error instead of burning all attempts", async () => {
      countLaunchTrainersMock.mockRejectedValue(
        new Error("ECIRCUITBREAKER: too many authentication failures, new connections are temporarily blocked"),
      );

      const stats = await getLaunchPromoStats();

      expect(stats.trainerCountAvailable).toBe(false);
      expect(stats.trainerCount).toBe(0);
      // Retrying into an open breaker is futile — only the first attempt should run.
      expect(countLaunchTrainersMock).toHaveBeenCalledTimes(1);
    });

    it("recognizes the circuit-breaker message even without the ECIRCUITBREAKER code", async () => {
      countLaunchClientsMock.mockRejectedValue(
        new Error("too many authentication failures, new connections are temporarily blocked"),
      );

      const stats = await getLaunchPromoStats();

      expect(stats.clientCountAvailable).toBe(false);
      expect(countLaunchClientsMock).toHaveBeenCalledTimes(1);
    });

    it("still retries a plain (non-circuit-breaker) transient error up to the normal attempt count", async () => {
      countLaunchTrainersMock.mockRejectedValue(new Error("connection reset"));

      const stats = await getLaunchPromoStats();

      expect(stats.trainerCountAvailable).toBe(false);
      expect(countLaunchTrainersMock).toHaveBeenCalledTimes(3);
    });

    it("never holds the whole stats call open past the total retry budget, even if every attempt hangs", async () => {
      vi.useFakeTimers();
      try {
        // Never resolves or rejects on its own — simulates a stuck connection attempt against a
        // pooler with no connectionTimeoutMillis set (see withTimeout's doc comment).
        countLaunchTrainersMock.mockImplementation(() => new Promise(() => {}));

        const statsPromise = getLaunchPromoStats();
        // Well past TRANSIENT_RETRY_TOTAL_BUDGET_MS (4s) — if the budget ceiling didn't apply,
        // this promise would still be pending here.
        await vi.advanceTimersByTimeAsync(10_000);
        const stats = await statsPromise;

        expect(stats.trainerCountAvailable).toBe(false);
        expect(stats.trainerCount).toBe(0);
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
