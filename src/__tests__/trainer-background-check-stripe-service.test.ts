import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockTrainerProfileUpsert,
  mockTrainerProfileFindUnique,
  mockPaymentIntentsCreate,
  mockPaymentIntentsRetrieve,
  mockGetStripe,
  mockInitiateTrainerBackgroundCheck,
} = vi.hoisted(() => ({
  mockTrainerProfileUpsert: vi.fn(),
  mockTrainerProfileFindUnique: vi.fn(),
  mockPaymentIntentsCreate: vi.fn(),
  mockPaymentIntentsRetrieve: vi.fn(),
  mockGetStripe: vi.fn(),
  mockInitiateTrainerBackgroundCheck: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainerProfile: {
      upsert: mockTrainerProfileUpsert,
      findUnique: mockTrainerProfileFindUnique,
    },
  },
}));

vi.mock("@/lib/trainer-background-check-initiate", () => ({
  initiateTrainerBackgroundCheck: mockInitiateTrainerBackgroundCheck,
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

describe("trainer background check Stripe service", () => {
  const prevFeeUsd = process.env.NEXT_PUBLIC_TRAINER_BACKGROUND_CHECK_FEE_USD;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_TRAINER_BACKGROUND_CHECK_FEE_USD = "49.99";
    mockGetStripe.mockReturnValue({
      paymentIntents: {
        create: mockPaymentIntentsCreate,
        retrieve: mockPaymentIntentsRetrieve,
      },
    });
    mockPaymentIntentsCreate.mockResolvedValue({
      id: "pi_test_123",
      client_secret: "cs_test_123",
    });
    mockTrainerProfileUpsert.mockResolvedValue(undefined);
    mockTrainerProfileFindUnique.mockResolvedValue({
      serviceZipCode: "90210",
      w9Json: null,
      betaSlotInPersonHeld: false,
    });
    mockInitiateTrainerBackgroundCheck.mockResolvedValue({
      externalReference: "mock-bg-abc",
      status: "submitted",
      screeningState: "CA",
    });
  });

  afterAll(() => {
    if (prevFeeUsd === undefined) {
      delete process.env.NEXT_PUBLIC_TRAINER_BACKGROUND_CHECK_FEE_USD;
      return;
    }
    process.env.NEXT_PUBLIC_TRAINER_BACKGROUND_CHECK_FEE_USD = prevFeeUsd;
  });

  it("upserts background check payment state with rounded-down cents", async () => {
    await applyTrainerBackgroundCheckStripePayment({
      trainerId: "trainer_1",
      vendorPaidCents: 4999.99,
    });

    expect(mockTrainerProfileUpsert).toHaveBeenCalledWith({
      where: { trainerId: "trainer_1" },
      create: {
        trainerId: "trainer_1",
        hasPaidBackgroundFee: true,
        backgroundCheckVendorPaidCents: 4999,
      },
      update: {
        hasPaidBackgroundFee: true,
        backgroundCheckVendorPaidCents: 4999,
        updatedAt: expect.any(Date),
      },
    });
  });

  it("clamps vendorPaidCents to at least one cent when applying payment", async () => {
    await applyTrainerBackgroundCheckStripePayment({
      trainerId: "trainer_2",
      vendorPaidCents: 0,
    });

    expect(mockTrainerProfileUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          trainerId: "trainer_2",
          backgroundCheckVendorPaidCents: 1,
        }),
      }),
    );
  });

  it("creates a Stripe PaymentIntent with trainer metadata and returns secrets", async () => {
    const result = await createTrainerBackgroundCheckPaymentIntent({
      trainerId: "trainer_1",
      email: "trainer@example.com",
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
        screeningState: "CA",
        screeningZip: "90210",
      },
    });
    expect(result).toEqual({
      clientSecret: "cs_test_123",
      paymentIntentId: "pi_test_123",
    });
  });

  it("throws when Stripe server client is unavailable during intent creation", async () => {
    mockGetStripe.mockReturnValueOnce(null);

    await expect(
      createTrainerBackgroundCheckPaymentIntent({
        trainerId: "trainer_1",
        email: "trainer@example.com",
      }),
    ).rejects.toThrow("STRIPE_SECRET_KEY is not configured.");
  });

  it("throws when Stripe intent creation does not return a client secret", async () => {
    mockPaymentIntentsCreate.mockResolvedValueOnce({
      id: "pi_test_456",
      client_secret: null,
    });

    await expect(
      createTrainerBackgroundCheckPaymentIntent({
        trainerId: "trainer_1",
        email: "trainer@example.com",
      }),
    ).rejects.toThrow("Stripe did not return a client secret for this payment.");
  });

  it("throws when Stripe server client is unavailable during payment confirmation", async () => {
    mockGetStripe.mockReturnValueOnce(null);

    await expect(
      confirmTrainerBackgroundCheckPaymentIntent({
        trainerId: "trainer_1",
        paymentIntentId: "pi_test_123",
      }),
    ).rejects.toThrow("STRIPE_SECRET_KEY is not configured.");
  });

  it("rejects confirmation when intent purpose is not background check", async () => {
    mockPaymentIntentsRetrieve.mockResolvedValueOnce({
      id: "pi_test_123",
      status: "succeeded",
      amount_received: 4999,
      metadata: {
        purpose: "trainer_registration_fee",
        trainerId: "trainer_1",
      },
    });

    await expect(
      confirmTrainerBackgroundCheckPaymentIntent({
        trainerId: "trainer_1",
        paymentIntentId: "pi_test_123",
      }),
    ).rejects.toThrow("This payment is not a background check charge.");
  });

  it("rejects confirmation when intent trainer metadata does not match session trainer", async () => {
    mockPaymentIntentsRetrieve.mockResolvedValueOnce({
      id: "pi_test_123",
      status: "succeeded",
      amount_received: 4999,
      metadata: {
        purpose: TRAINER_BACKGROUND_CHECK_STRIPE_PURPOSE,
        trainerId: "trainer_other",
      },
    });

    await expect(
      confirmTrainerBackgroundCheckPaymentIntent({
        trainerId: "trainer_1",
        paymentIntentId: "pi_test_123",
      }),
    ).rejects.toThrow("Payment does not belong to this trainer.");
  });

  it("rejects confirmation when payment intent has not succeeded", async () => {
    mockPaymentIntentsRetrieve.mockResolvedValueOnce({
      id: "pi_test_123",
      status: "processing",
      amount_received: 0,
      metadata: {
        purpose: TRAINER_BACKGROUND_CHECK_STRIPE_PURPOSE,
        trainerId: "trainer_1",
      },
    });

    await expect(
      confirmTrainerBackgroundCheckPaymentIntent({
        trainerId: "trainer_1",
        paymentIntentId: "pi_test_123",
      }),
    ).rejects.toThrow("Payment has not completed yet.");
  });

  it("applies amount_received when confirming a succeeded background check payment", async () => {
    mockPaymentIntentsRetrieve.mockResolvedValueOnce({
      id: "pi_test_123",
      status: "succeeded",
      amount_received: 5200,
      metadata: {
        purpose: TRAINER_BACKGROUND_CHECK_STRIPE_PURPOSE,
        trainerId: "trainer_1",
      },
    });

    await confirmTrainerBackgroundCheckPaymentIntent({
      trainerId: "trainer_1",
      paymentIntentId: "pi_test_123",
    });

    expect(mockTrainerProfileUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { trainerId: "trainer_1" },
        create: expect.objectContaining({
          trainerId: "trainer_1",
          backgroundCheckVendorPaidCents: 5200,
        }),
      }),
    );
    expect(mockInitiateTrainerBackgroundCheck).toHaveBeenCalledWith({ trainerId: "trainer_1" });
  });

  it("falls back to configured fee amount when Stripe amount_received is not positive", async () => {
    process.env.NEXT_PUBLIC_TRAINER_BACKGROUND_CHECK_FEE_USD = "63.21";
    mockPaymentIntentsRetrieve.mockResolvedValueOnce({
      id: "pi_test_123",
      status: "succeeded",
      amount_received: 0,
      metadata: {
        purpose: TRAINER_BACKGROUND_CHECK_STRIPE_PURPOSE,
        trainerId: "trainer_1",
      },
    });

    await confirmTrainerBackgroundCheckPaymentIntent({
      trainerId: "trainer_1",
      paymentIntentId: "pi_test_123",
    });

    expect(mockTrainerProfileUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          backgroundCheckVendorPaidCents: 6321,
        }),
      }),
    );
  });
});
