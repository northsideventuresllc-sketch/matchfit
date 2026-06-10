import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetAppOrigin,
  mockFeeMetadataFromBreakdown,
  mockGetStripe,
  mockComputeTrainerSignupEscrowSplit,
  mockComputeTrainerSignupPlatformHoldCents,
  mockComputeTrainerSignupBackgroundEscrowHoldCents,
  mockSignupEscrowMetadata,
  mockCreateTrainerSignupBackgroundEscrowPaymentIntent,
  mockCheckoutSessionsCreate,
} = vi.hoisted(() => ({
  mockGetAppOrigin: vi.fn(),
  mockFeeMetadataFromBreakdown: vi.fn(),
  mockGetStripe: vi.fn(),
  mockComputeTrainerSignupEscrowSplit: vi.fn(),
  mockComputeTrainerSignupPlatformHoldCents: vi.fn(),
  mockComputeTrainerSignupBackgroundEscrowHoldCents: vi.fn(),
  mockSignupEscrowMetadata: vi.fn(),
  mockCreateTrainerSignupBackgroundEscrowPaymentIntent: vi.fn(),
  mockCheckoutSessionsCreate: vi.fn(),
}));

vi.mock("@/lib/app-origin", () => ({
  getAppOrigin: mockGetAppOrigin,
}));

vi.mock("@/lib/stripe-checkout-line-items", () => ({
  feeMetadataFromBreakdown: mockFeeMetadataFromBreakdown,
}));

vi.mock("@/lib/stripe-server", () => ({
  getStripe: mockGetStripe,
}));

vi.mock("@/lib/trainer-signup-escrow", () => ({
  computeTrainerSignupEscrowSplit: mockComputeTrainerSignupEscrowSplit,
  computeTrainerSignupPlatformHoldCents: mockComputeTrainerSignupPlatformHoldCents,
  computeTrainerSignupBackgroundEscrowHoldCents: mockComputeTrainerSignupBackgroundEscrowHoldCents,
  signupEscrowMetadata: mockSignupEscrowMetadata,
}));

vi.mock("@/lib/trainer-signup-fee-hold", () => ({
  createTrainerSignupBackgroundEscrowPaymentIntent: mockCreateTrainerSignupBackgroundEscrowPaymentIntent,
  TRAINER_SIGNUP_BG_ESCROW_PURPOSE: "trainer_signup_bg_escrow",
  TRAINER_SIGNUP_PLATFORM_HOLD_PURPOSE: "trainer_signup_platform_hold",
}));

import {
  createTrainerSignupFeeHoldCheckoutSession,
  paymentIntentIdFromCheckoutSession,
} from "@/lib/trainer-signup-fee-hold-checkout";

describe("trainer-signup-fee-hold-checkout", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetAppOrigin.mockReturnValue("https://matchfit.app/");
    mockFeeMetadataFromBreakdown.mockReturnValue({
      feeBaseCents: "980",
      feeProcessingCents: "1000",
      feeTotalCents: "1980",
    });
    mockComputeTrainerSignupEscrowSplit.mockReturnValue({
      baseCents: 5880,
      backgroundCheckEscrowCents: 4900,
      platformEscrowCents: 980,
    });
    mockComputeTrainerSignupPlatformHoldCents.mockReturnValue(1980);
    mockComputeTrainerSignupBackgroundEscrowHoldCents.mockReturnValue(4900);
    mockSignupEscrowMetadata.mockReturnValue({
      pricingVersion: "v1",
    });
    mockCreateTrainerSignupBackgroundEscrowPaymentIntent.mockResolvedValue({
      paymentIntentId: "pi_bg",
      clientSecret: "cs_bg",
      holdCents: 4900,
    });

    mockGetStripe.mockReturnValue({
      checkout: {
        sessions: {
          create: mockCheckoutSessionsCreate,
        },
      },
    });
    mockCheckoutSessionsCreate.mockResolvedValue({
      url: "https://checkout.stripe.com/session/cs_test",
    });
  });

  it("throws when Stripe billing is not configured", async () => {
    mockGetStripe.mockReturnValueOnce(null);

    await expect(
      createTrainerSignupFeeHoldCheckoutSession({
        trainerId: "trainer_1",
        email: "coach@example.com",
        pricingMode: "FOUNDING_BG_SURCHARGE_20PCT",
      }),
    ).rejects.toThrow("Billing is not configured.");
  });

  it("throws when trainer email is invalid", async () => {
    await expect(
      createTrainerSignupFeeHoldCheckoutSession({
        trainerId: "trainer_1",
        email: "not-an-email",
        pricingMode: "FOUNDING_BG_SURCHARGE_20PCT",
      }),
    ).rejects.toThrow("Trainer account email is missing or invalid for Stripe checkout.");
  });

  it("creates checkout session and returns platform + background totals", async () => {
    const result = await createTrainerSignupFeeHoldCheckoutSession({
      trainerId: "trainer_1",
      email: " coach@example.com ",
      pricingMode: "FOUNDING_BG_SURCHARGE_20PCT",
    });

    expect(mockCreateTrainerSignupBackgroundEscrowPaymentIntent).toHaveBeenCalledWith({
      trainerId: "trainer_1",
      email: "coach@example.com",
      pricingMode: "FOUNDING_BG_SURCHARGE_20PCT",
    });
    expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "payment",
        customer_email: "coach@example.com",
        metadata: expect.objectContaining({
          purpose: "trainer_signup_platform_hold",
          trainerId: "trainer_1",
          pricingMode: "FOUNDING_BG_SURCHARGE_20PCT",
          backgroundCheckPaymentIntentId: "pi_bg",
        }),
        success_url: "https://matchfit.app/trainer/signup/payment/return?session_id={CHECKOUT_SESSION_ID}",
        cancel_url: "https://matchfit.app/trainer/signup/payment?canceled=1",
      }),
    );
    expect(result).toEqual({
      url: "https://checkout.stripe.com/session/cs_test",
      baseCents: 5880,
      totalCents: 6880,
      backgroundCheckPaymentIntentId: "pi_bg",
    });
  });

  it("respects explicit origin override and strips trailing slash", async () => {
    await createTrainerSignupFeeHoldCheckoutSession({
      trainerId: "trainer_1",
      email: "coach@example.com",
      pricingMode: "STANDARD_100_MINUS_BG",
      origin: "https://preview.matchfit.app/",
    });

    expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        success_url:
          "https://preview.matchfit.app/trainer/signup/payment/return?session_id={CHECKOUT_SESSION_ID}",
        cancel_url: "https://preview.matchfit.app/trainer/signup/payment?canceled=1",
      }),
    );
  });

  it("throws when Stripe checkout session has no URL", async () => {
    mockCheckoutSessionsCreate.mockResolvedValueOnce({ url: null });

    await expect(
      createTrainerSignupFeeHoldCheckoutSession({
        trainerId: "trainer_1",
        email: "coach@example.com",
        pricingMode: "FOUNDING_BG_SURCHARGE_20PCT",
      }),
    ).rejects.toThrow("Could not start checkout.");
  });

  it("extracts payment intent id from checkout session shape", () => {
    expect(paymentIntentIdFromCheckoutSession("pi_1")).toBe("pi_1");
    expect(paymentIntentIdFromCheckoutSession({ id: "pi_2" })).toBe("pi_2");
    expect(paymentIntentIdFromCheckoutSession({ id: "" })).toBe("");
    expect(paymentIntentIdFromCheckoutSession(null)).toBeNull();
    expect(paymentIntentIdFromCheckoutSession(undefined)).toBeNull();
  });
});
