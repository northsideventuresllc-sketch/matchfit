import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";

const { mockGetStripe, mockPaymentIntentsCreate, mockPaymentIntentsRetrieve, mockTrainerProfileUpsert } = vi.hoisted(() => ({
  mockGetStripe: vi.fn(),
  mockPaymentIntentsCreate: vi.fn(),
  mockPaymentIntentsRetrieve: vi.fn(),
  mockTrainerProfileUpsert: vi.fn(),
}));

vi.mock("@/lib/stripe-server", () => ({
  getStripe: mockGetStripe,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainerProfile: {
      upsert: mockTrainerProfileUpsert,
    },
  },
}));

import {
  TRAINER_BACKGROUND_CHECK_STRIPE_PURPOSE,
  applyTrainerBackgroundCheckStripePayment,
  confirmTrainerBackgroundCheckPaymentIntent,
  createTrainerBackgroundCheckPaymentIntent,
} from "@/lib/trainer-background-check-stripe";

describe("trainer background check stripe service", () => {
  const prevUsd = process.env.NEXT_PUBLIC_TRAINER_BACKGROUND_CHECK_FEE_USD;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_TRAINER_BACKGROUND_CHECK_FEE_USD = "49.99";

    const stripeMock = {
      paymentIntents: {
        create: mockPaymentIntentsCreate,
        retrieve: mockPaymentIntentsRetrieve,
      },
    } as unknown as Stripe;
    mockGetStripe.mockReturnValue(stripeMock);
    mockTrainerProfileUpsert.mockResolvedValue({});
  });

  afterEach(() => {
    if (prevUsd === undefined) delete process.env.NEXT_PUBLIC_TRAINER_BACKGROUND_CHECK_FEE_USD;
    else process.env.NEXT_PUBLIC_TRAINER_BACKGROUND_CHECK_FEE_USD = prevUsd;
  });

  it("upserts trainer profile with floor-rounded paid cents", async () => {
    await applyTrainerBackgroundCheckStripePayment({
      trainerId: "trainer_1",
      vendorPaidCents: 2710.9,
    });

    expect(mockTrainerProfileUpsert).toHaveBeenCalledWith({
      where: { trainerId: "trainer_1" },
      create: {
        trainerId: "trainer_1",
        hasPaidBackgroundFee: true,
        backgroundCheckVendorPaidCents: 2710,
      },
      update: {
        hasPaidBackgroundFee: true,
        backgroundCheckVendorPaidCents: 2710,
        updatedAt: expect.any(Date),
      },
    });
  });

  it("clamps paid cents to at least one when persisting", async () => {
    await applyTrainerBackgroundCheckStripePayment({
      trainerId: "trainer_2",
      vendorPaidCents: 0,
    });

    expect(mockTrainerProfileUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ backgroundCheckVendorPaidCents: 1 }),
        update: expect.objectContaining({ backgroundCheckVendorPaidCents: 1 }),
      }),
    );
  });

  it("throws when creating a payment intent without Stripe configured", async () => {
    mockGetStripe.mockReturnValueOnce(null);

    await expect(
      createTrainerBackgroundCheckPaymentIntent({
        trainerId: "trainer_1",
        email: "coach@example.com",
      }),
    ).rejects.toThrow("STRIPE_SECRET_KEY is not configured.");
  });

  it("creates a background-check payment intent and returns identifiers", async () => {
    mockPaymentIntentsCreate.mockResolvedValueOnce({
      id: "pi_test_123",
      client_secret: "pi_client_secret_123",
    } as Stripe.PaymentIntent);

    const result = await createTrainerBackgroundCheckPaymentIntent({
      trainerId: "trainer_1",
      email: "coach@example.com",
    });

    expect(mockPaymentIntentsCreate).toHaveBeenCalledWith({
      amount: 4999,
      currency: "usd",
      receipt_email: "coach@example.com",
      automatic_payment_methods: { enabled: true },
      metadata: {
        purpose: TRAINER_BACKGROUND_CHECK_STRIPE_PURPOSE,
        trainerId: "trainer_1",
        vendorPaidCents: "4999",
      },
    });
    expect(result).toEqual({
      clientSecret: "pi_client_secret_123",
      paymentIntentId: "pi_test_123",
    });
  });

  it("throws when Stripe omits a client secret on created payment intents", async () => {
    mockPaymentIntentsCreate.mockResolvedValueOnce({
      id: "pi_test_missing_secret",
      client_secret: null,
    } as Stripe.PaymentIntent);

    await expect(
      createTrainerBackgroundCheckPaymentIntent({
        trainerId: "trainer_1",
        email: "coach@example.com",
      }),
    ).rejects.toThrow("Stripe did not return a client secret for this payment.");
  });

  it("throws when confirming a payment intent without Stripe configured", async () => {
    mockGetStripe.mockReturnValueOnce(null);

    await expect(
      confirmTrainerBackgroundCheckPaymentIntent({
        trainerId: "trainer_1",
        paymentIntentId: "pi_test_123",
      }),
    ).rejects.toThrow("STRIPE_SECRET_KEY is not configured.");
  });

  it("rejects payment intents that are not tagged for trainer background checks", async () => {
    mockPaymentIntentsRetrieve.mockResolvedValueOnce({
      id: "pi_test_123",
      status: "succeeded",
      metadata: { purpose: "something_else", trainerId: "trainer_1" },
      amount_received: 5000,
    } as Stripe.PaymentIntent);

    await expect(
      confirmTrainerBackgroundCheckPaymentIntent({
        trainerId: "trainer_1",
        paymentIntentId: "pi_test_123",
      }),
    ).rejects.toThrow("This payment is not a background check charge.");
  });

  it("rejects payment intents that belong to another trainer", async () => {
    mockPaymentIntentsRetrieve.mockResolvedValueOnce({
      id: "pi_test_123",
      status: "succeeded",
      metadata: {
        purpose: TRAINER_BACKGROUND_CHECK_STRIPE_PURPOSE,
        trainerId: "trainer_other",
      },
      amount_received: 5000,
    } as Stripe.PaymentIntent);

    await expect(
      confirmTrainerBackgroundCheckPaymentIntent({
        trainerId: "trainer_1",
        paymentIntentId: "pi_test_123",
      }),
    ).rejects.toThrow("Payment does not belong to this trainer.");
  });

  it("rejects payment intents that have not succeeded yet", async () => {
    mockPaymentIntentsRetrieve.mockResolvedValueOnce({
      id: "pi_test_123",
      status: "processing",
      metadata: {
        purpose: TRAINER_BACKGROUND_CHECK_STRIPE_PURPOSE,
        trainerId: "trainer_1",
      },
      amount_received: 0,
    } as Stripe.PaymentIntent);

    await expect(
      confirmTrainerBackgroundCheckPaymentIntent({
        trainerId: "trainer_1",
        paymentIntentId: "pi_test_123",
      }),
    ).rejects.toThrow("Payment has not completed yet.");
  });

  it("persists amount_received when confirming successful payment intents", async () => {
    mockPaymentIntentsRetrieve.mockResolvedValueOnce({
      id: "pi_test_123",
      status: "succeeded",
      metadata: {
        purpose: TRAINER_BACKGROUND_CHECK_STRIPE_PURPOSE,
        trainerId: "trainer_1",
      },
      amount_received: 6125,
    } as Stripe.PaymentIntent);

    await confirmTrainerBackgroundCheckPaymentIntent({
      trainerId: "trainer_1",
      paymentIntentId: "pi_test_123",
    });

    expect(mockTrainerProfileUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { trainerId: "trainer_1" },
        update: expect.objectContaining({
          hasPaidBackgroundFee: true,
          backgroundCheckVendorPaidCents: 6125,
          updatedAt: expect.any(Date),
        }),
      }),
    );
  });

  it("falls back to configured fee amount when amount_received is unavailable", async () => {
    process.env.NEXT_PUBLIC_TRAINER_BACKGROUND_CHECK_FEE_USD = "33.33";
    mockPaymentIntentsRetrieve.mockResolvedValueOnce({
      id: "pi_test_123",
      status: "succeeded",
      metadata: {
        purpose: TRAINER_BACKGROUND_CHECK_STRIPE_PURPOSE,
        trainerId: "trainer_1",
      },
      amount_received: 0,
    } as Stripe.PaymentIntent);

    await confirmTrainerBackgroundCheckPaymentIntent({
      trainerId: "trainer_1",
      paymentIntentId: "pi_test_123",
    });

    expect(mockTrainerProfileUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ backgroundCheckVendorPaidCents: 3333 }),
      }),
    );
  });
});
