import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockFinalizeRegistrationAfterPayment,
  mockNotifyClientMembershipTrialEnding,
  mockNotifyTrainerRegistrationFeeReceipt,
  mockTrainerProfileUpdateMany,
  mockTrainerFindUnique,
  mockClientUpdateMany,
  mockNotifyClientSubscriptionStripeEvent,
  mockSyncClientSubscriptionFromStripe,
  mockApplyTrainerBackgroundCheckStripePayment,
  mockIsTrainerBackgroundCheckPaymentIntent,
  mockGetStripe,
  mockCreditTokensFromStripePurchase,
  mockGetPromoPackTierById,
  mockRecordTrainerServiceTransactionAndReward,
  mockConstructEvent,
  mockCheckoutSessionsRetrieve,
  mockSubscriptionsRetrieve,
} = vi.hoisted(() => ({
  mockFinalizeRegistrationAfterPayment: vi.fn(),
  mockNotifyClientMembershipTrialEnding: vi.fn(),
  mockNotifyTrainerRegistrationFeeReceipt: vi.fn(),
  mockTrainerProfileUpdateMany: vi.fn(),
  mockTrainerFindUnique: vi.fn(),
  mockClientUpdateMany: vi.fn(),
  mockNotifyClientSubscriptionStripeEvent: vi.fn(),
  mockSyncClientSubscriptionFromStripe: vi.fn(),
  mockApplyTrainerBackgroundCheckStripePayment: vi.fn(),
  mockIsTrainerBackgroundCheckPaymentIntent: vi.fn(),
  mockGetStripe: vi.fn(),
  mockCreditTokensFromStripePurchase: vi.fn(),
  mockGetPromoPackTierById: vi.fn(),
  mockRecordTrainerServiceTransactionAndReward: vi.fn(),
  mockConstructEvent: vi.fn(),
  mockCheckoutSessionsRetrieve: vi.fn(),
  mockSubscriptionsRetrieve: vi.fn(),
}));

vi.mock("@/lib/billing-finalize", () => ({
  finalizeRegistrationAfterPayment: mockFinalizeRegistrationAfterPayment,
}));

vi.mock("@/lib/client-membership-email-notify", () => ({
  notifyClientMembershipTrialEnding: mockNotifyClientMembershipTrialEnding,
  notifyTrainerRegistrationFeeReceipt: mockNotifyTrainerRegistrationFeeReceipt,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainerProfile: {
      updateMany: mockTrainerProfileUpdateMany,
    },
    trainer: {
      findUnique: mockTrainerFindUnique,
    },
    client: {
      updateMany: mockClientUpdateMany,
    },
  },
}));

vi.mock("@/lib/subscription-email-notify", () => ({
  notifyClientSubscriptionStripeEvent: mockNotifyClientSubscriptionStripeEvent,
}));

vi.mock("@/lib/stripe-sync-client-subscription", () => ({
  syncClientSubscriptionFromStripe: mockSyncClientSubscriptionFromStripe,
}));

vi.mock("@/lib/trainer-background-check-stripe", () => ({
  applyTrainerBackgroundCheckStripePayment: mockApplyTrainerBackgroundCheckStripePayment,
  isTrainerBackgroundCheckPaymentIntent: mockIsTrainerBackgroundCheckPaymentIntent,
}));

vi.mock("@/lib/stripe-server", () => ({
  getStripe: mockGetStripe,
}));

vi.mock("@/lib/trainer-promo-tokens", () => ({
  creditTokensFromStripePurchase: mockCreditTokensFromStripePurchase,
  getPromoPackTierById: mockGetPromoPackTierById,
  recordTrainerServiceTransactionAndReward: mockRecordTrainerServiceTransactionAndReward,
  TOKENS_PER_USD_PACK: 100,
}));

import { POST, dynamic } from "@/app/api/webhooks/stripe/route";

function webhookRequest(body: string, signature = "sig_test"): Request {
  const headers = new Headers();
  if (signature) headers.set("stripe-signature", signature);
  return new Request("https://example.test/api/webhooks/stripe", {
    method: "POST",
    headers,
    body,
  });
}

describe("POST /api/webhooks/stripe payment_intent background check handling", () => {
  const prevWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";

    mockApplyTrainerBackgroundCheckStripePayment.mockResolvedValue(undefined);
    mockIsTrainerBackgroundCheckPaymentIntent.mockReturnValue(true);

    mockGetStripe.mockReturnValue({
      webhooks: {
        constructEvent: mockConstructEvent,
      },
      checkout: {
        sessions: {
          retrieve: mockCheckoutSessionsRetrieve,
        },
      },
      subscriptions: {
        retrieve: mockSubscriptionsRetrieve,
      },
    });
  });

  afterEach(() => {
    if (prevWebhookSecret === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
    else process.env.STRIPE_WEBHOOK_SECRET = prevWebhookSecret;
  });

  it("is configured as force-dynamic", () => {
    expect(dynamic).toBe("force-dynamic");
  });

  it("returns 503 when webhook integration is not configured", async () => {
    mockGetStripe.mockReturnValueOnce(null);

    const response = await POST(webhookRequest("{}"));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "Webhooks not configured." });
  });

  it("returns 400 when the Stripe signature header is missing", async () => {
    const response = await POST(webhookRequest("{}", ""));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Missing signature." });
    expect(mockConstructEvent).not.toHaveBeenCalled();
  });

  it("returns 400 when Stripe signature verification fails", async () => {
    mockConstructEvent.mockImplementationOnce(() => {
      throw new Error("bad signature");
    });

    const response = await POST(webhookRequest('{"id":"evt_1"}'));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid signature." });
  });

  it("applies paid background fee from amount_received for succeeded payment intents", async () => {
    mockConstructEvent.mockReturnValueOnce({
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: "pi_1",
          metadata: {
            trainerId: "trainer_1",
            purpose: "trainer_background_check_fee",
            vendorPaidCents: "4900",
          },
          amount_received: 5100,
        },
      },
    });

    const response = await POST(webhookRequest('{"id":"evt_1"}'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ received: true });
    expect(mockIsTrainerBackgroundCheckPaymentIntent).toHaveBeenCalledWith(
      expect.objectContaining({ id: "pi_1" }),
    );
    expect(mockApplyTrainerBackgroundCheckStripePayment).toHaveBeenCalledWith({
      trainerId: "trainer_1",
      vendorPaidCents: 5100,
    });
  });

  it("falls back to metadata vendorPaidCents when amount_received is unavailable", async () => {
    mockConstructEvent.mockReturnValueOnce({
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: "pi_2",
          metadata: {
            trainerId: "trainer_2",
            purpose: "trainer_background_check_fee",
            vendorPaidCents: "4700",
          },
          amount_received: 0,
        },
      },
    });

    const response = await POST(webhookRequest('{"id":"evt_2"}'));

    expect(response.status).toBe(200);
    expect(mockApplyTrainerBackgroundCheckStripePayment).toHaveBeenCalledWith({
      trainerId: "trainer_2",
      vendorPaidCents: 4700,
    });
  });

  it("skips background fee persistence for non-background payment intents", async () => {
    mockIsTrainerBackgroundCheckPaymentIntent.mockReturnValueOnce(false);
    mockConstructEvent.mockReturnValueOnce({
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: "pi_other",
          metadata: { trainerId: "trainer_3" },
          amount_received: 6200,
        },
      },
    });

    const response = await POST(webhookRequest('{"id":"evt_3"}'));

    expect(response.status).toBe(200);
    expect(mockApplyTrainerBackgroundCheckStripePayment).not.toHaveBeenCalled();
  });

  it("skips background fee persistence when trainer id is missing or amount is non-positive", async () => {
    mockConstructEvent.mockReturnValueOnce({
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: "pi_missing_trainer",
          metadata: { trainerId: "   ", vendorPaidCents: "4900" },
          amount_received: 5200,
        },
      },
    });

    const missingTrainerResponse = await POST(webhookRequest('{"id":"evt_4"}'));
    expect(missingTrainerResponse.status).toBe(200);
    expect(mockApplyTrainerBackgroundCheckStripePayment).not.toHaveBeenCalled();

    mockConstructEvent.mockReturnValueOnce({
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: "pi_zero_cents",
          metadata: { trainerId: "trainer_4", vendorPaidCents: "0" },
          amount_received: 0,
        },
      },
    });

    const zeroCentsResponse = await POST(webhookRequest('{"id":"evt_5"}'));
    expect(zeroCentsResponse.status).toBe(200);
    expect(mockApplyTrainerBackgroundCheckStripePayment).not.toHaveBeenCalled();
  });

  it("returns 500 when background fee persistence throws", async () => {
    mockApplyTrainerBackgroundCheckStripePayment.mockRejectedValueOnce(new Error("db unavailable"));
    mockConstructEvent.mockReturnValueOnce({
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: "pi_failure",
          metadata: { trainerId: "trainer_5", vendorPaidCents: "4900" },
          amount_received: 4900,
        },
      },
    });

    const response = await POST(webhookRequest('{"id":"evt_6"}'));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Webhook handler failed." });
  });
});
