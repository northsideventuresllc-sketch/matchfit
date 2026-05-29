import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetStripe,
  mockStripeObjectIsLiveBilling,
  mockStripeSubscriptionRetrieve,
  mockClientFindFirst,
  mockClientUpdate,
} = vi.hoisted(() => ({
  mockGetStripe: vi.fn(),
  mockStripeObjectIsLiveBilling: vi.fn(),
  mockStripeSubscriptionRetrieve: vi.fn(),
  mockClientFindFirst: vi.fn(),
  mockClientUpdate: vi.fn(),
}));

vi.mock("@/lib/stripe-server", () => ({
  getStripe: mockGetStripe,
  stripeObjectIsLiveBilling: mockStripeObjectIsLiveBilling,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    client: {
      findFirst: mockClientFindFirst,
      update: mockClientUpdate,
    },
  },
}));

import { syncClientSubscriptionFromStripe } from "@/lib/stripe-sync-client-subscription";

describe("syncClientSubscriptionFromStripe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-27T12:00:00.000Z"));

    mockGetStripe.mockReturnValue({
      subscriptions: {
        retrieve: mockStripeSubscriptionRetrieve,
      },
    });
    mockStripeObjectIsLiveBilling.mockImplementation((livemode: boolean | null | undefined) => livemode === true);
    mockStripeSubscriptionRetrieve.mockResolvedValue({
      status: "active",
      livemode: true,
    });
    mockClientFindFirst.mockResolvedValue({
      id: "client_1",
      subscriptionGraceUntil: null,
    });
    mockClientUpdate.mockResolvedValue({});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns early when Stripe is not configured", async () => {
    mockGetStripe.mockReturnValueOnce(null);

    await expect(syncClientSubscriptionFromStripe("sub_1")).resolves.toBeUndefined();

    expect(mockStripeSubscriptionRetrieve).not.toHaveBeenCalled();
    expect(mockClientFindFirst).not.toHaveBeenCalled();
    expect(mockClientUpdate).not.toHaveBeenCalled();
  });

  it("returns early when no client exists for the subscription id", async () => {
    mockClientFindFirst.mockResolvedValueOnce(null);

    await expect(syncClientSubscriptionFromStripe("sub_missing")).resolves.toBeUndefined();

    expect(mockStripeSubscriptionRetrieve).toHaveBeenCalledWith("sub_missing");
    expect(mockClientUpdate).not.toHaveBeenCalled();
  });

  it("marks active subscriptions as active and clears grace", async () => {
    mockStripeSubscriptionRetrieve.mockResolvedValueOnce({
      status: "trialing",
      livemode: false,
    });

    await syncClientSubscriptionFromStripe("sub_active");

    expect(mockClientUpdate).toHaveBeenCalledWith({
      where: { id: "client_1" },
      data: {
        stripeSubscriptionActive: true,
        subscriptionGraceUntil: null,
        stripeBillingLiveMode: false,
      },
    });
    expect(mockStripeObjectIsLiveBilling).toHaveBeenCalledWith(false);
  });

  it("preserves an existing future grace window for inactive subscriptions", async () => {
    const existingGrace = new Date("2026-05-30T15:00:00.000Z");
    mockStripeSubscriptionRetrieve.mockResolvedValueOnce({
      status: "past_due",
      livemode: true,
    });
    mockClientFindFirst.mockResolvedValueOnce({
      id: "client_1",
      subscriptionGraceUntil: existingGrace,
    });

    await syncClientSubscriptionFromStripe("sub_past_due");

    expect(mockClientUpdate).toHaveBeenCalledWith({
      where: { id: "client_1" },
      data: {
        stripeSubscriptionActive: false,
        subscriptionGraceUntil: existingGrace,
        stripeBillingLiveMode: true,
      },
    });
  });

  it("starts a new 72-hour grace window when inactive and grace is missing/expired", async () => {
    mockStripeSubscriptionRetrieve.mockResolvedValueOnce({
      status: "canceled",
      livemode: true,
    });
    mockClientFindFirst.mockResolvedValueOnce({
      id: "client_1",
      subscriptionGraceUntil: new Date("2026-05-25T12:00:00.000Z"),
    });

    await syncClientSubscriptionFromStripe("sub_canceled");

    const call = mockClientUpdate.mock.calls[0]?.[0] as {
      data: { stripeSubscriptionActive: boolean; subscriptionGraceUntil: Date; stripeBillingLiveMode: boolean };
    };
    expect(call.data.stripeSubscriptionActive).toBe(false);
    expect(call.data.stripeBillingLiveMode).toBe(true);
    expect(call.data.subscriptionGraceUntil.toISOString()).toBe("2026-05-30T12:00:00.000Z");
  });
});
