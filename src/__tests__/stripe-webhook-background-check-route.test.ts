import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

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
  mockCreditTokensFromStripePurchase,
  mockGetPromoPackTierById,
  mockRecordTrainerServiceTransactionAndReward,
  mockGetStripe,
  mockConstructEvent,
  mockCheckoutSessionRetrieve,
  mockStripeSubscriptionRetrieve,
  mockSyncTrainerComplianceWindow,
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
  mockCreditTokensFromStripePurchase: vi.fn(),
  mockGetPromoPackTierById: vi.fn(),
  mockRecordTrainerServiceTransactionAndReward: vi.fn(),
  mockGetStripe: vi.fn(),
  mockConstructEvent: vi.fn(),
  mockCheckoutSessionRetrieve: vi.fn(),
  mockStripeSubscriptionRetrieve: vi.fn(),
  mockSyncTrainerComplianceWindow: vi.fn(),
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

vi.mock("@/lib/trainer-compliance-window-sync", () => ({
  applyTrainerSignupFeeHoldAuthorized: vi.fn(),
  syncTrainerComplianceWindow: mockSyncTrainerComplianceWindow,
}));

vi.mock("@/lib/stripe-server", () => ({
  getStripe: mockGetStripe,
}));

vi.mock("@/lib/trainer-promo-tokens", () => ({
  creditTokensFromStripePurchase: mockCreditTokensFromStripePurchase,
  getPromoPackTierById: mockGetPromoPackTierById,
  recordTrainerServiceTransactionAndReward: mockRecordTrainerServiceTransactionAndReward,
  TOKENS_PER_USD_PACK: 50,
}));

import { POST, dynamic } from "@/app/api/webhooks/stripe/route";

function webhookRequest(body: string, signature = "sig_test"): Request {
  return new Request("https://example.test/api/webhooks/stripe", {
    method: "POST",
    headers: { "stripe-signature": signature },
    body,
  });
}

describe("POST /api/webhooks/stripe (background check payment intents)", () => {
  const previousSecret = process.env.STRIPE_WEBHOOK_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    mockGetStripe.mockReturnValue({
      webhooks: {
        constructEvent: mockConstructEvent,
      },
      checkout: {
        sessions: {
          retrieve: mockCheckoutSessionRetrieve,
        },
      },
      subscriptions: {
        retrieve: mockStripeSubscriptionRetrieve,
      },
    });
    mockIsTrainerBackgroundCheckPaymentIntent.mockReturnValue(true);
    mockApplyTrainerBackgroundCheckStripePayment.mockResolvedValue(undefined);
    mockSyncTrainerComplianceWindow.mockResolvedValue(undefined);
  });

  afterAll(() => {
    if (previousSecret === undefined) {
      delete process.env.STRIPE_WEBHOOK_SECRET;
      return;
    }
    process.env.STRIPE_WEBHOOK_SECRET = previousSecret;
  });

  it("is configured as force-dynamic", () => {
    expect(dynamic).toBe("force-dynamic");
  });

  it("returns 503 when webhooks are not configured", async () => {
    mockGetStripe.mockReturnValueOnce(null);

    const res = await POST(webhookRequest("{}"));

    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({ error: "Webhooks not configured." });
  });

  it("returns 400 when signature header is missing", async () => {
    const res = await POST(
      new Request("https://example.test/api/webhooks/stripe", {
        method: "POST",
        body: "{}",
      }),
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Missing signature." });
  });

  it("returns 400 for invalid webhook signatures", async () => {
    mockConstructEvent.mockImplementationOnce(() => {
      throw new Error("invalid signature");
    });

    const res = await POST(webhookRequest("{\"id\":\"evt_1\"}"));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Invalid signature." });
  });

  it("applies trainer background payment from payment_intent.succeeded amount_received", async () => {
    mockConstructEvent.mockReturnValueOnce({
      type: "payment_intent.succeeded",
      data: {
        object: {
          metadata: { trainerId: "trainer_1", vendorPaidCents: "4900" },
          amount_received: 5200,
        },
      },
    });

    const res = await POST(webhookRequest("{\"id\":\"evt_background_paid\"}"));

    expect(mockIsTrainerBackgroundCheckPaymentIntent).toHaveBeenCalled();
    expect(mockApplyTrainerBackgroundCheckStripePayment).toHaveBeenCalledWith({
      trainerId: "trainer_1",
      vendorPaidCents: 5200,
    });
    expect(mockSyncTrainerComplianceWindow).toHaveBeenCalledWith("trainer_1");
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ received: true });
  });

  it("falls back to metadata vendorPaidCents when amount_received is not positive", async () => {
    mockConstructEvent.mockReturnValueOnce({
      type: "payment_intent.succeeded",
      data: {
        object: {
          metadata: { trainerId: "trainer_1", vendorPaidCents: "4900" },
          amount_received: 0,
        },
      },
    });

    await POST(webhookRequest("{\"id\":\"evt_background_meta_fallback\"}"));

    expect(mockApplyTrainerBackgroundCheckStripePayment).toHaveBeenCalledWith({
      trainerId: "trainer_1",
      vendorPaidCents: 4900,
    });
  });

  it("skips applying payment when event is not background-check purpose or trainer id is missing", async () => {
    mockIsTrainerBackgroundCheckPaymentIntent.mockReturnValueOnce(false);
    mockConstructEvent.mockReturnValueOnce({
      type: "payment_intent.succeeded",
      data: {
        object: {
          metadata: { trainerId: "trainer_1" },
          amount_received: 4900,
        },
      },
    });

    await POST(webhookRequest("{\"id\":\"evt_non_bg\"}"));

    mockConstructEvent.mockReturnValueOnce({
      type: "payment_intent.succeeded",
      data: {
        object: {
          metadata: { trainerId: "   ", vendorPaidCents: "4900" },
          amount_received: 0,
        },
      },
    });

    await POST(webhookRequest("{\"id\":\"evt_missing_trainer\"}"));

    expect(mockApplyTrainerBackgroundCheckStripePayment).not.toHaveBeenCalled();
  });

  it("returns 500 when applying trainer background payment throws", async () => {
    mockConstructEvent.mockReturnValueOnce({
      type: "payment_intent.succeeded",
      data: {
        object: {
          metadata: { trainerId: "trainer_1", vendorPaidCents: "4900" },
          amount_received: 4900,
        },
      },
    });
    mockApplyTrainerBackgroundCheckStripePayment.mockRejectedValueOnce(new Error("db failed"));

    const res = await POST(webhookRequest("{\"id\":\"evt_apply_error\"}"));

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "Webhook handler failed." });
  });
});
