import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockDefaultBackgroundCheckVendorPaidCents,
  mockTrainerProfileUpsert,
  mockGetStripe,
  mockPaymentIntentsCreate,
  mockPaymentIntentsRetrieve,
} = vi.hoisted(() => ({
  mockDefaultBackgroundCheckVendorPaidCents: vi.fn(),
  mockTrainerProfileUpsert: vi.fn(),
  mockGetStripe: vi.fn(),
  mockPaymentIntentsCreate: vi.fn(),
  mockPaymentIntentsRetrieve: vi.fn(),
}));

vi.mock("@/lib/checkr", () => ({
  defaultBackgroundCheckVendorPaidCents: mockDefaultBackgroundCheckVendorPaidCents,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainerProfile: {
      upsert: mockTrainerProfileUpsert,
    },
  },
}));

vi.mock("@/lib/stripe-server", () => ({
  getStripe: mockGetStripe,
}));

import {
  TRAINER_BACKGROUND_CHECK_STRIPE_PURPOSE,
  applyTrainerBackgroundCheckStripePayment,
  confirmTrainerBackgroundCheckPaymentIntent,
  createTrainerBackgroundCheckPaymentIntent,
} from "@/lib/trainer-background-check-stripe";

describe("trainer background-check Stripe helpers", () => {
  const previousUsd = process.env.NEXT_PUBLIC_TRAINER_BACKGROUND_CHECK_FEE_USD;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.NEXT_PUBLIC_TRAINER_BACKGROUND_CHECK_FEE_USD;
    mockDefaultBackgroundCheckVendorPaidCents.mockReturnValue(4900);
    mockTrainerProfileUpsert.mockResolvedValue({});
    mockPaymentIntentsCreate.mockResolvedValue({
      id: "pi_created",
      client_secret: "pi_secret_123",
    });
    mockPaymentIntentsRetrieve.mockResolvedValue({
      id: "pi_retrieved",
      status: "succeeded",
      amount_received: 4900,
      metadata: {
        purpose: TRAINER_BACKGROUND_CHECK_STRIPE_PURPOSE,
        trainerId: "trainer_1",
      },
    });
    mockGetStripe.mockReturnValue({
      paymentIntents: {
        create: mockPaymentIntentsCreate,
        retrieve: mockPaymentIntentsRetrieve,
      },
    });
  });

  afterEach(() => {
    if (previousUsd === undefined) {
      delete process.env.NEXT_PUBLIC_TRAINER_BACKGROUND_CHECK_FEE_USD;
      return;
    }
    process.env.NEXT_PUBLIC_TRAINER_BACKGROUND_CHECK_FEE_USD = previousUsd;
  });

  it("persists a minimum of one cent when applying background-check payment", async () => {
    await applyTrainerBackgroundCheckStripePayment({
      trainerId: "trainer_min",
      vendorPaidCents: 0.4,
    });

    expect(mockTrainerProfileUpsert).toHaveBeenCalledWith({
      where: { trainerId: "trainer_min" },
      create: {
        trainerId: "trainer_min",
        hasPaidBackgroundFee: true,
        backgroundCheckVendorPaidCents: 1,
      },
      update: {
        hasPaidBackgroundFee: true,
        backgroundCheckVendorPaidCents: 1,
        updatedAt: expect.any(Date),
      },
    });
  });

  it("creates a payment intent using configured amount and metadata", async () => {
    process.env.NEXT_PUBLIC_TRAINER_BACKGROUND_CHECK_FEE_USD = " 49.99 ";

    const result = await createTrainerBackgroundCheckPaymentIntent({
      trainerId: "trainer_1",
      email: "trainer@example.com",
    });

    expect(result).toEqual({
      clientSecret: "pi_secret_123",
      paymentIntentId: "pi_created",
    });
    expect(mockPaymentIntentsCreate).toHaveBeenCalledWith({
      amount: 4999,
      currency: "usd",
      receipt_email: "trainer@example.com",
      automatic_payment_methods: { enabled: true },
      metadata: {
        purpose: TRAINER_BACKGROUND_CHECK_STRIPE_PURPOSE,
        trainerId: "trainer_1",
        vendorPaidCents: "4999",
      },
    });
  });

  it("throws when Stripe client is not configured for create", async () => {
    mockGetStripe.mockReturnValueOnce(undefined);

    await expect(
      createTrainerBackgroundCheckPaymentIntent({
        trainerId: "trainer_1",
        email: "trainer@example.com",
      }),
    ).rejects.toThrow(/STRIPE_SECRET_KEY is not configured/i);
  });

  it("throws when Stripe omits the payment-intent client secret", async () => {
    mockPaymentIntentsCreate.mockResolvedValueOnce({
      id: "pi_missing_secret",
      client_secret: null,
    });

    await expect(
      createTrainerBackgroundCheckPaymentIntent({
        trainerId: "trainer_1",
        email: "trainer@example.com",
      }),
    ).rejects.toThrow(/client secret/i);
  });

  it("rejects confirm when payment metadata purpose does not match", async () => {
    mockPaymentIntentsRetrieve.mockResolvedValueOnce({
      id: "pi_wrong_purpose",
      status: "succeeded",
      amount_received: 4900,
      metadata: { purpose: "other", trainerId: "trainer_1" },
    });

    await expect(
      confirmTrainerBackgroundCheckPaymentIntent({
        trainerId: "trainer_1",
        paymentIntentId: "pi_wrong_purpose",
      }),
    ).rejects.toThrow(/not a background check charge/i);
    expect(mockTrainerProfileUpsert).not.toHaveBeenCalled();
  });

  it("rejects confirm when payment belongs to another trainer", async () => {
    mockPaymentIntentsRetrieve.mockResolvedValueOnce({
      id: "pi_wrong_trainer",
      status: "succeeded",
      amount_received: 4900,
      metadata: {
        purpose: TRAINER_BACKGROUND_CHECK_STRIPE_PURPOSE,
        trainerId: "trainer_2",
      },
    });

    await expect(
      confirmTrainerBackgroundCheckPaymentIntent({
        trainerId: "trainer_1",
        paymentIntentId: "pi_wrong_trainer",
      }),
    ).rejects.toThrow(/does not belong to this trainer/i);
    expect(mockTrainerProfileUpsert).not.toHaveBeenCalled();
  });

  it("rejects confirm when payment is not yet succeeded", async () => {
    mockPaymentIntentsRetrieve.mockResolvedValueOnce({
      id: "pi_processing",
      status: "processing",
      amount_received: 4900,
      metadata: {
        purpose: TRAINER_BACKGROUND_CHECK_STRIPE_PURPOSE,
        trainerId: "trainer_1",
      },
    });

    await expect(
      confirmTrainerBackgroundCheckPaymentIntent({
        trainerId: "trainer_1",
        paymentIntentId: "pi_processing",
      }),
    ).rejects.toThrow(/not completed yet/i);
    expect(mockTrainerProfileUpsert).not.toHaveBeenCalled();
  });

  it("uses Stripe amount_received when confirming a successful payment", async () => {
    mockPaymentIntentsRetrieve.mockResolvedValueOnce({
      id: "pi_succeeded",
      status: "succeeded",
      amount_received: 5500,
      metadata: {
        purpose: TRAINER_BACKGROUND_CHECK_STRIPE_PURPOSE,
        trainerId: "trainer_1",
      },
    });

    await confirmTrainerBackgroundCheckPaymentIntent({
      trainerId: "trainer_1",
      paymentIntentId: "pi_succeeded",
    });

    expect(mockPaymentIntentsRetrieve).toHaveBeenCalledWith("pi_succeeded");
    expect(mockTrainerProfileUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          backgroundCheckVendorPaidCents: 5500,
        }),
      }),
    );
  });

  it("falls back to configured amount when Stripe amount_received is unavailable", async () => {
    process.env.NEXT_PUBLIC_TRAINER_BACKGROUND_CHECK_FEE_USD = "52.5";
    mockPaymentIntentsRetrieve.mockResolvedValueOnce({
      id: "pi_fallback",
      status: "succeeded",
      amount_received: 0,
      metadata: {
        purpose: TRAINER_BACKGROUND_CHECK_STRIPE_PURPOSE,
        trainerId: "trainer_1",
      },
    });

    await confirmTrainerBackgroundCheckPaymentIntent({
      trainerId: "trainer_1",
      paymentIntentId: "pi_fallback",
    });

    expect(mockTrainerProfileUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          backgroundCheckVendorPaidCents: 5250,
        }),
      }),
    );
  });
});
