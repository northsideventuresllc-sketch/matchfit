import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockFinalizeRegistrationAfterPayment,
  mockNotifyClientMembershipTrialEnding,
  mockNotifyTrainerRegistrationFeeReceipt,
  mockClientUpdateMany,
  mockTrainerProfileUpdateMany,
  mockTrainerFindUnique,
  mockNotifyClientSubscriptionStripeEvent,
  mockSyncClientSubscriptionFromStripe,
  mockApplyTrainerBackgroundCheckStripePayment,
  mockIsTrainerBackgroundCheckPaymentIntent,
  mockGetStripe,
  mockConstructEvent,
  mockCreditTokensFromStripePurchase,
  mockGetPromoPackTierById,
  mockRecordTrainerServiceTransactionAndReward,
  mockCheckoutSessionRetrieve,
  mockStripeSubscriptionRetrieve,
} = vi.hoisted(() => ({
  mockFinalizeRegistrationAfterPayment: vi.fn(),
  mockNotifyClientMembershipTrialEnding: vi.fn(),
  mockNotifyTrainerRegistrationFeeReceipt: vi.fn(),
  mockClientUpdateMany: vi.fn(),
  mockTrainerProfileUpdateMany: vi.fn(),
  mockTrainerFindUnique: vi.fn(),
  mockNotifyClientSubscriptionStripeEvent: vi.fn(),
  mockSyncClientSubscriptionFromStripe: vi.fn(),
  mockApplyTrainerBackgroundCheckStripePayment: vi.fn(),
  mockIsTrainerBackgroundCheckPaymentIntent: vi.fn(),
  mockGetStripe: vi.fn(),
  mockConstructEvent: vi.fn(),
  mockCreditTokensFromStripePurchase: vi.fn(),
  mockGetPromoPackTierById: vi.fn(),
  mockRecordTrainerServiceTransactionAndReward: vi.fn(),
  mockCheckoutSessionRetrieve: vi.fn(),
  mockStripeSubscriptionRetrieve: vi.fn(),
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
    client: { updateMany: mockClientUpdateMany },
    trainerProfile: { updateMany: mockTrainerProfileUpdateMany },
    trainer: { findUnique: mockTrainerFindUnique },
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
  TOKENS_PER_USD_PACK: 50,
}));

import { POST, dynamic } from "@/app/api/webhooks/stripe/route";

function webhookRequest(body = '{"id":"evt_1"}', signature = "sig_test"): Request {
  const headers = new Headers();
  if (signature) {
    headers.set("stripe-signature", signature);
  }
  return new Request("https://example.test/api/webhooks/stripe", {
    method: "POST",
    headers,
    body,
  });
}

describe("POST /api/webhooks/stripe (background check payment intents)", () => {
  const previousSecret = process.env.STRIPE_WEBHOOK_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    mockConstructEvent.mockReturnValue({
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: "pi_background_1",
          metadata: {
            trainerId: "trainer_1",
            vendorPaidCents: "4900",
          },
          amount_received: 5200,
        },
      },
    });
    mockGetStripe.mockReturnValue({
      webhooks: { constructEvent: mockConstructEvent },
      checkout: { sessions: { retrieve: mockCheckoutSessionRetrieve } },
      subscriptions: { retrieve: mockStripeSubscriptionRetrieve },
    });
    mockIsTrainerBackgroundCheckPaymentIntent.mockReturnValue(true);
    mockApplyTrainerBackgroundCheckStripePayment.mockResolvedValue(undefined);
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
    mockGetStripe.mockReturnValueOnce(undefined);
    const noStripeResponse = await POST(webhookRequest());
    expect(noStripeResponse.status).toBe(503);
    await expect(noStripeResponse.json()).resolves.toEqual({ error: "Webhooks not configured." });

    delete process.env.STRIPE_WEBHOOK_SECRET;
    const noSecretResponse = await POST(webhookRequest());
    expect(noSecretResponse.status).toBe(503);
    await expect(noSecretResponse.json()).resolves.toEqual({ error: "Webhooks not configured." });
  });

  it("returns 400 when signature is missing", async () => {
    const response = await POST(webhookRequest('{"id":"evt_no_sig"}', ""));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Missing signature." });
    expect(mockConstructEvent).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid webhook signatures", async () => {
    mockConstructEvent.mockImplementationOnce(() => {
      throw new Error("invalid signature");
    });

    const response = await POST(webhookRequest('{"id":"evt_bad_sig"}'));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid signature." });
  });

  it("applies trainer background payment from amount_received", async () => {
    const response = await POST(webhookRequest('{"id":"evt_paid"}'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ received: true });
    expect(mockApplyTrainerBackgroundCheckStripePayment).toHaveBeenCalledWith({
      trainerId: "trainer_1",
      vendorPaidCents: 5200,
    });
  });

  it("falls back to metadata vendorPaidCents when amount_received is not positive", async () => {
    mockConstructEvent.mockReturnValueOnce({
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: "pi_metadata_fallback",
          metadata: {
            trainerId: "trainer_1",
            vendorPaidCents: "4900",
          },
          amount_received: 0,
        },
      },
    });

    const response = await POST(webhookRequest('{"id":"evt_metadata_fallback"}'));

    expect(response.status).toBe(200);
    expect(mockApplyTrainerBackgroundCheckStripePayment).toHaveBeenCalledWith({
      trainerId: "trainer_1",
      vendorPaidCents: 4900,
    });
  });

  it("skips background payment writes when event is not eligible", async () => {
    mockIsTrainerBackgroundCheckPaymentIntent.mockReturnValueOnce(false);
    await POST(webhookRequest('{"id":"evt_not_background"}'));
    expect(mockApplyTrainerBackgroundCheckStripePayment).not.toHaveBeenCalled();

    mockConstructEvent.mockReturnValueOnce({
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: "pi_missing_trainer",
          metadata: { trainerId: "  ", vendorPaidCents: "4900" },
          amount_received: 4900,
        },
      },
    });
    await POST(webhookRequest('{"id":"evt_blank_trainer"}'));
    expect(mockApplyTrainerBackgroundCheckStripePayment).not.toHaveBeenCalled();

    mockConstructEvent.mockReturnValueOnce({
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: "pi_zero_amount",
          metadata: { trainerId: "trainer_1", vendorPaidCents: "0" },
          amount_received: 0,
        },
      },
    });
    await POST(webhookRequest('{"id":"evt_zero_amount"}'));
    expect(mockApplyTrainerBackgroundCheckStripePayment).not.toHaveBeenCalled();
  });

  it("returns 500 when background payment apply throws", async () => {
    mockApplyTrainerBackgroundCheckStripePayment.mockRejectedValueOnce(new Error("db failed"));

    const response = await POST(webhookRequest('{"id":"evt_apply_error"}'));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Webhook handler failed." });
  });
});
