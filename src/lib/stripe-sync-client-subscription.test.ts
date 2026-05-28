import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockClientFindFirst,
  mockClientUpdate,
  mockGetStripe,
  mockStripeObjectIsLiveBilling,
  mockRetrieveSubscription,
} = vi.hoisted(() => ({
  mockClientFindFirst: vi.fn(),
  mockClientUpdate: vi.fn(),
  mockGetStripe: vi.fn(),
  mockStripeObjectIsLiveBilling: vi.fn<(livemode: boolean | null | undefined) => boolean>(),
  mockRetrieveSubscription: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    client: {
      findFirst: mockClientFindFirst,
      update: mockClientUpdate,
    },
  },
}));

vi.mock("@/lib/stripe-server", () => ({
  getStripe: mockGetStripe,
  stripeObjectIsLiveBilling: mockStripeObjectIsLiveBilling,
}));

import { syncClientSubscriptionFromStripe } from "@/lib/stripe-sync-client-subscription";

describe("syncClientSubscriptionFromStripe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-28T12:00:00.000Z"));

    mockRetrieveSubscription.mockResolvedValue({ status: "active", livemode: true });
    mockGetStripe.mockReturnValue({
      subscriptions: {
        retrieve: mockRetrieveSubscription,
      },
    });
    mockClientFindFirst.mockResolvedValue({
      id: "client_123",
      subscriptionGraceUntil: null,
    });
    mockClientUpdate.mockResolvedValue(undefined);
    mockStripeObjectIsLiveBilling.mockImplementation((livemode) => livemode === true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns immediately when Stripe is unavailable", async () => {
    mockGetStripe.mockReturnValueOnce(null);

    await expect(syncClientSubscriptionFromStripe("sub_missing_stripe")).resolves.toBeUndefined();
    expect(mockRetrieveSubscription).not.toHaveBeenCalled();
    expect(mockClientFindFirst).not.toHaveBeenCalled();
    expect(mockClientUpdate).not.toHaveBeenCalled();
  });

  it("stops when no local client matches the subscription id", async () => {
    mockClientFindFirst.mockResolvedValueOnce(null);

    await expect(syncClientSubscriptionFromStripe("sub_no_client")).resolves.toBeUndefined();
    expect(mockRetrieveSubscription).toHaveBeenCalledWith("sub_no_client");
    expect(mockClientUpdate).not.toHaveBeenCalled();
  });

  it("marks active subscriptions as active and clears grace", async () => {
    mockRetrieveSubscription.mockResolvedValueOnce({ status: "trialing", livemode: false });

    await expect(syncClientSubscriptionFromStripe("sub_trialing")).resolves.toBeUndefined();

    expect(mockStripeObjectIsLiveBilling).toHaveBeenCalledWith(false);
    expect(mockClientUpdate).toHaveBeenCalledWith({
      where: { id: "client_123" },
      data: {
        stripeSubscriptionActive: true,
        subscriptionGraceUntil: null,
        stripeBillingLiveMode: false,
      },
    });
  });

  it("preserves an existing future grace window for inactive subscriptions", async () => {
    const futureGrace = new Date("2026-05-29T12:00:00.000Z");
    mockRetrieveSubscription.mockResolvedValueOnce({ status: "past_due", livemode: true });
    mockClientFindFirst.mockResolvedValueOnce({
      id: "client_456",
      subscriptionGraceUntil: futureGrace,
    });

    await expect(syncClientSubscriptionFromStripe("sub_past_due")).resolves.toBeUndefined();

    expect(mockClientUpdate).toHaveBeenCalledWith({
      where: { id: "client_456" },
      data: {
        stripeSubscriptionActive: false,
        subscriptionGraceUntil: futureGrace,
        stripeBillingLiveMode: true,
      },
    });
  });

  it("starts a new 72-hour grace window when subscription is inactive and none exists", async () => {
    mockRetrieveSubscription.mockResolvedValueOnce({ status: "canceled", livemode: true });
    mockClientFindFirst.mockResolvedValueOnce({
      id: "client_789",
      subscriptionGraceUntil: null,
    });

    await expect(syncClientSubscriptionFromStripe("sub_canceled")).resolves.toBeUndefined();

    const updateArgs = mockClientUpdate.mock.calls[0]?.[0] as {
      where: { id: string };
      data: { stripeSubscriptionActive: boolean; subscriptionGraceUntil: Date; stripeBillingLiveMode: boolean };
    };
    expect(updateArgs.where.id).toBe("client_789");
    expect(updateArgs.data.stripeSubscriptionActive).toBe(false);
    expect(updateArgs.data.stripeBillingLiveMode).toBe(true);
    expect(updateArgs.data.subscriptionGraceUntil.toISOString()).toBe("2026-05-31T12:00:00.000Z");
  });
});
