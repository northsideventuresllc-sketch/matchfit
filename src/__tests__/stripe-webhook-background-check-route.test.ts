import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
  TOKENS_PER_USD_PACK: 500,
}));

import { POST, dynamic } from "@/app/api/webhooks/stripe/route";

function webhookRequest(signature = "sig_123", body = '{"id":"evt_1"}'): Request {
  const headers = new Headers();
  if (signature) {
    headers.set("stripe-signature", signature);
  }
  return new Request("https://matchfit.test/api/webhooks/stripe", {
    method: "POST",
    headers,
    body,
  });
}

describe("POST /api/webhooks/stripe background-check branch", () => {
  const previousWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_123";
    mockConstructEvent.mockReturnValue({
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: "pi_success",
          amount_received: 5300,
          metadata: {
            trainerId: "trainer_1",
            vendorPaidCents: "5300",
          },
        },
      },
    });
    mockIsTrainerBackgroundCheckPaymentIntent.mockReturnValue(true);
    mockApplyTrainerBackgroundCheckStripePayment.mockResolvedValue(undefined);
    mockGetStripe.mockReturnValue({
      webhooks: { constructEvent: mockConstructEvent },
    });
    mockFinalizeRegistrationAfterPayment.mockResolvedValue(undefined);
    mockNotifyClientMembershipTrialEnding.mockResolvedValue(undefined);
    mockNotifyTrainerRegistrationFeeReceipt.mockResolvedValue(undefined);
    mockSyncClientSubscriptionFromStripe.mockResolvedValue(undefined);
    mockNotifyClientSubscriptionStripeEvent.mockResolvedValue(undefined);
    mockCreditTokensFromStripePurchase.mockResolvedValue(undefined);
    mockGetPromoPackTierById.mockReturnValue(null);
    mockRecordTrainerServiceTransactionAndReward.mockResolvedValue(undefined);
    mockClientUpdateMany.mockResolvedValue({ count: 0 });
    mockTrainerProfileUpdateMany.mockResolvedValue({ count: 0 });
    mockTrainerFindUnique.mockResolvedValue(null);
  });

  afterEach(() => {
    if (previousWebhookSecret === undefined) {
      delete process.env.STRIPE_WEBHOOK_SECRET;
      return;
    }
    process.env.STRIPE_WEBHOOK_SECRET = previousWebhookSecret;
  });

  it("is configured as force-dynamic", () => {
    expect(dynamic).toBe("force-dynamic");
  });

  it("returns 503 when webhook configuration is missing", async () => {
    mockGetStripe.mockReturnValueOnce(undefined);

    const noStripeResponse = await POST(webhookRequest());
    expect(noStripeResponse.status).toBe(503);
    await expect(noStripeResponse.json()).resolves.toEqual({
      error: "Webhooks not configured.",
    });

    delete process.env.STRIPE_WEBHOOK_SECRET;
    const noSecretResponse = await POST(webhookRequest());
    expect(noSecretResponse.status).toBe(503);
  });

  it("returns 400 when signature is missing", async () => {
    const response = await POST(webhookRequest(""));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Missing signature." });
    expect(mockConstructEvent).not.toHaveBeenCalled();
  });

  it("returns 400 when Stripe signature verification fails", async () => {
    mockConstructEvent.mockImplementationOnce(() => {
      throw new Error("bad signature");
    });

    const response = await POST(webhookRequest("sig_bad"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid signature." });
  });

  it("applies trainer background payment from amount_received", async () => {
    const response = await POST(webhookRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ received: true });
    expect(mockIsTrainerBackgroundCheckPaymentIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        amount_received: 5300,
      }),
    );
    expect(mockApplyTrainerBackgroundCheckStripePayment).toHaveBeenCalledWith({
      trainerId: "trainer_1",
      vendorPaidCents: 5300,
    });
  });

  it("falls back to metadata vendorPaidCents when amount_received is absent", async () => {
    mockConstructEvent.mockReturnValueOnce({
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: "pi_metadata_amount",
          amount_received: 0,
          metadata: {
            trainerId: "trainer_1",
            vendorPaidCents: "4900",
          },
        },
      },
    });

    const response = await POST(webhookRequest());

    expect(response.status).toBe(200);
    expect(mockApplyTrainerBackgroundCheckStripePayment).toHaveBeenCalledWith({
      trainerId: "trainer_1",
      vendorPaidCents: 4900,
    });
  });

  it("does not apply payment when trainerId is blank or amount is invalid", async () => {
    mockConstructEvent.mockReturnValueOnce({
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: "pi_blank_trainer",
          amount_received: 5300,
          metadata: {
            trainerId: "   ",
            vendorPaidCents: "5300",
          },
        },
      },
    });

    const blankTrainerResponse = await POST(webhookRequest());
    expect(blankTrainerResponse.status).toBe(200);
    expect(mockApplyTrainerBackgroundCheckStripePayment).not.toHaveBeenCalled();

    mockConstructEvent.mockReturnValueOnce({
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: "pi_zero_amount",
          amount_received: 0,
          metadata: {
            trainerId: "trainer_1",
            vendorPaidCents: "0",
          },
        },
      },
    });
    const invalidAmountResponse = await POST(webhookRequest());
    expect(invalidAmountResponse.status).toBe(200);
    expect(mockApplyTrainerBackgroundCheckStripePayment).not.toHaveBeenCalled();
  });

  it("returns 500 when handler branch throws unexpectedly", async () => {
    mockApplyTrainerBackgroundCheckStripePayment.mockRejectedValueOnce(new Error("write failed"));

    const response = await POST(webhookRequest());

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Webhook handler failed.",
    });
  });
});
