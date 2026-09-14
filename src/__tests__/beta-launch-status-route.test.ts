import { beforeEach, describe, expect, it, vi } from "vitest";

const getLaunchPromoStatsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/launch-promo-stats", () => ({
  getLaunchPromoStats: getLaunchPromoStatsMock,
}));

import { GET, dynamic } from "@/app/api/public/beta-launch-status/route";

const baseStats = {
  gatesEnabled: true,
  trainerCount: 2,
  clientCount: 12,
  trainerCountAvailable: true,
  clientCountAvailable: true,
  trainerFoundingMax: 30,
  clientFoundingMax: 150,
  trainerFoundingRemaining: 28,
  clientFoundingRemaining: 138,
  trainerFoundingActive: true,
  clientFoundingActive: true,
  trainerBetaCap: 100,
  clientBetaCap: 200,
  trainerBetaSlotsUsed: 90,
  clientBetaSlotsUsed: 195,
  trainerBetaSlotsAvailable: true,
  clientBetaSlotsAvailable: true,
  trainerBetaSlotsRemaining: 10,
  clientBetaSlotsRemaining: 5,
  trainerWaitlistOpen: false,
  clientWaitlistOpen: true,
};

describe("GET /api/public/beta-launch-status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getLaunchPromoStatsMock.mockResolvedValue(baseStats);
  });

  it("is configured as force-dynamic", () => {
    expect(dynamic).toBe("force-dynamic");
  });

  it("returns gates-disabled payload with null counters", async () => {
    getLaunchPromoStatsMock.mockResolvedValueOnce({
      ...baseStats,
      gatesEnabled: false,
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      gatesEnabled: false,
      trainerCap: null,
      clientCap: null,
      trainerCount: null,
      clientCount: null,
      trainerSlotsUsed: null,
      clientSlotsUsed: null,
      trainerSlotsRemaining: null,
      clientSlotsRemaining: null,
      trainerFoundingMax: null,
      clientFoundingMax: null,
      trainerFoundingRemaining: null,
      clientFoundingRemaining: null,
      trainerWaitlistOpen: false,
      clientWaitlistOpen: false,
    });
  });

  it("returns beta status payload when gates are enabled", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      gatesEnabled: true,
      trainerCap: 100,
      clientCap: 200,
      trainerCount: 2,
      clientCount: 12,
      trainerSlotsUsed: 90,
      clientSlotsUsed: 195,
      trainerSlotsRemaining: 10,
      clientSlotsRemaining: 5,
      trainerFoundingMax: 30,
      clientFoundingMax: 150,
      trainerFoundingRemaining: 28,
      clientFoundingRemaining: 138,
      trainerWaitlistOpen: false,
      clientWaitlistOpen: true,
    });
    expect(getLaunchPromoStatsMock).toHaveBeenCalledTimes(1);
  });

  it("nulls out counts and anything derived from them when the underlying query failed", async () => {
    getLaunchPromoStatsMock.mockResolvedValueOnce({
      ...baseStats,
      trainerCountAvailable: false,
      trainerBetaSlotsAvailable: false,
      clientBetaSlotsAvailable: false,
      // Even though the source data claims full, an unavailable count must not report it as such.
      trainerWaitlistOpen: true,
    });

    const response = await GET();
    const body = await response.json();

    expect(body.trainerCount).toBeNull();
    expect(body.trainerFoundingRemaining).toBeNull();
    expect(body.clientSlotsUsed).toBeNull();
    expect(body.clientSlotsRemaining).toBeNull();
    expect(body.trainerWaitlistOpen).toBe(false);
    // Unaffected fields still come through.
    expect(body.clientCount).toBe(12);
    expect(body.trainerCap).toBe(100);
  });
});
