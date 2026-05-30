import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetStripe,
  mockStripeObjectIsLiveBilling,
  mockSubscriptionRetrieve,
  mockClientFindFirst,
  mockClientUpdate,
} = vi.hoisted(() => ({
  mockGetStripe: vi.fn(),
  mockStripeObjectIsLiveBilling: vi.fn(),
  mockSubscriptionRetrieve: vi.fn(),
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
    mockGetStripe.mockReturnValue({
      subscriptions: {
        retrieve: mockSubscriptionRetrieve,
      },
    });
    mockStripeObjectIsLiveBilling.mockImplementation((livemode: unknown) => livemode === true);
    mockClientFindFirst.mockResolvedValue({
      id: "client_1",
      subscriptionGraceUntil: null,
    });
    mockSubscriptionRetrieve.mockResolvedValue({
      status: "active",
      livemode: true,
    });
    mockClientUpdate.mockResolvedValue({});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns early when Stripe is not configured", async () => {
    mockGetStripe.mockReturnValueOnce(null);

    await syncClientSubscriptionFromStripe("sub_test_missing");

    expect(mockSubscriptionRetrieve).not.toHaveBeenCalled();
    expect(mockClientFindFirst).not.toHaveBeenCalled();
    expect(mockClientUpdate).not.toHaveBeenCalled();
  });

  it("returns after retrieving Stripe subscription when no client maps to the subscription id", async () => {
    mockClientFindFirst.mockResolvedValueOnce(null);

    await syncClientSubscriptionFromStripe("sub_missing_client");

    expect(mockSubscriptionRetrieve).toHaveBeenCalledWith("sub_missing_client");
    expect(mockClientFindFirst).toHaveBeenCalledWith({
      where: { stripeSubscriptionId: "sub_missing_client" },
      select: { id: true, subscriptionGraceUntil: true },
    });
    expect(mockClientUpdate).not.toHaveBeenCalled();
  });

  it("marks active subscriptions as active, clears grace, and tracks livemode", async () => {
    mockSubscriptionRetrieve.mockResolvedValueOnce({
      status: "trialing",
      livemode: true,
    });

    await syncClientSubscriptionFromStripe("sub_trialing");

    expect(mockStripeObjectIsLiveBilling).toHaveBeenCalledWith(true);
    expect(mockClientUpdate).toHaveBeenCalledWith({
      where: { id: "client_1" },
      data: {
        stripeSubscriptionActive: true,
        subscriptionGraceUntil: null,
        stripeBillingLiveMode: true,
      },
    });
  });

  it("reuses an existing future grace window for inactive subscriptions", async () => {
    const futureGrace = new Date("2026-06-01T00:00:00.000Z");
    mockClientFindFirst.mockResolvedValueOnce({
      id: "client_1",
      subscriptionGraceUntil: futureGrace,
    });
    mockSubscriptionRetrieve.mockResolvedValueOnce({
      status: "canceled",
      livemode: false,
    });

    await syncClientSubscriptionFromStripe("sub_canceled_existing_grace");

    expect(mockStripeObjectIsLiveBilling).toHaveBeenCalledWith(false);
    expect(mockClientUpdate).toHaveBeenCalledWith({
      where: { id: "client_1" },
      data: {
        stripeSubscriptionActive: false,
        subscriptionGraceUntil: futureGrace,
        stripeBillingLiveMode: false,
      },
    });
  });

  it("creates a new 72-hour grace window when subscription is inactive and no valid grace exists", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-28T20:00:00.000Z"));

    mockClientFindFirst.mockResolvedValueOnce({
      id: "client_1",
      subscriptionGraceUntil: new Date("2026-05-28T19:00:00.000Z"),
    });
    mockSubscriptionRetrieve.mockResolvedValueOnce({
      status: "incomplete_expired",
      livemode: false,
    });

    await syncClientSubscriptionFromStripe("sub_expired");

    expect(mockClientUpdate).toHaveBeenCalledTimes(1);
    const updateArg = mockClientUpdate.mock.calls[0]?.[0];
    expect(updateArg).toEqual(
      expect.objectContaining({
        where: { id: "client_1" },
        data: expect.objectContaining({
          stripeSubscriptionActive: false,
          stripeBillingLiveMode: false,
        }),
      }),
    );
    expect(updateArg?.data?.subscriptionGraceUntil).toBeInstanceOf(Date);
    expect((updateArg?.data?.subscriptionGraceUntil as Date).toISOString()).toBe("2026-05-31T20:00:00.000Z");
  });
});
