import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockComputeTrainerSignupEscrowSplit,
  mockComputeTrainerSignupPlatformHoldCents,
  mockComputeTrainerSignupBackgroundEscrowHoldCents,
  mockComputeTrainerSignupCombinedHoldCents,
  mockSignupEscrowMetadata,
  mockGetStripe,
  mockPaymentIntentsCreate,
} = vi.hoisted(() => ({
  mockComputeTrainerSignupEscrowSplit: vi.fn(),
  mockComputeTrainerSignupPlatformHoldCents: vi.fn(),
  mockComputeTrainerSignupBackgroundEscrowHoldCents: vi.fn(),
  mockComputeTrainerSignupCombinedHoldCents: vi.fn(),
  mockSignupEscrowMetadata: vi.fn(),
  mockGetStripe: vi.fn(),
  mockPaymentIntentsCreate: vi.fn(),
}));

vi.mock("@/lib/trainer-signup-escrow", () => ({
  computeTrainerSignupEscrowSplit: mockComputeTrainerSignupEscrowSplit,
  computeTrainerSignupPlatformHoldCents: mockComputeTrainerSignupPlatformHoldCents,
  computeTrainerSignupBackgroundEscrowHoldCents: mockComputeTrainerSignupBackgroundEscrowHoldCents,
  computeTrainerSignupCombinedHoldCents: mockComputeTrainerSignupCombinedHoldCents,
  signupEscrowMetadata: mockSignupEscrowMetadata,
  computeTrainerSignupCaptureOnSuccessCents: vi.fn(),
}));

vi.mock("@/lib/stripe-server", () => ({
  getStripe: mockGetStripe,
}));

import {
  createTrainerSignupFeeHoldPaymentIntent,
  createTrainerSignupFeeHoldPaymentIntents,
} from "@/lib/trainer-signup-fee-hold";

describe("trainer-signup-fee-hold", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockComputeTrainerSignupEscrowSplit.mockReturnValue({
      baseCents: 5880,
      platformEscrowCents: 980,
      backgroundCheckEscrowCents: 4900,
    });
    mockComputeTrainerSignupPlatformHoldCents.mockReturnValue(1980);
    mockComputeTrainerSignupBackgroundEscrowHoldCents.mockReturnValue(4900);
    mockComputeTrainerSignupCombinedHoldCents.mockReturnValue(6880);
    mockSignupEscrowMetadata.mockReturnValue({
      pricingVersion: "v1",
    });

    mockGetStripe.mockReturnValue({
      paymentIntents: {
        create: mockPaymentIntentsCreate,
      },
    });
  });

  it("creates linked platform/background manual-capture intents and returns hold breakdown", async () => {
    mockPaymentIntentsCreate
      .mockResolvedValueOnce({
        id: "pi_bg_1",
        client_secret: "cs_bg_1",
      })
      .mockResolvedValueOnce({
        id: "pi_platform_1",
        client_secret: "cs_platform_1",
      });

    const result = await createTrainerSignupFeeHoldPaymentIntents({
      trainerId: "trainer_1",
      email: "coach@example.com",
      pricingMode: "FOUNDING_BG_SURCHARGE_20PCT",
    });

    expect(mockPaymentIntentsCreate).toHaveBeenCalledTimes(2);
    expect(mockPaymentIntentsCreate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        amount: 4900,
        receipt_email: "coach@example.com",
        capture_method: "manual",
        metadata: expect.objectContaining({
          purpose: "trainer_signup_bg_escrow",
          trainerId: "trainer_1",
          holdSlice: "background_check",
          backgroundCheckHoldCents: "4900",
          pricingVersion: "v1",
        }),
      }),
    );
    expect(mockPaymentIntentsCreate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        amount: 1980,
        receipt_email: "coach@example.com",
        capture_method: "manual",
        metadata: expect.objectContaining({
          purpose: "trainer_signup_platform_hold",
          trainerId: "trainer_1",
          holdSlice: "platform",
          platformHoldCents: "1980",
          backgroundCheckPaymentIntentId: "pi_bg_1",
          pricingVersion: "v1",
        }),
      }),
    );

    expect(result).toEqual({
      platformClientSecret: "cs_platform_1",
      platformPaymentIntentId: "pi_platform_1",
      backgroundCheckClientSecret: "cs_bg_1",
      backgroundCheckPaymentIntentId: "pi_bg_1",
      baseCents: 5880,
      totalCents: 6880,
      platformHoldCents: 1980,
      backgroundCheckHoldCents: 4900,
    });
  });

  it("throws when Stripe is not configured", async () => {
    mockGetStripe.mockReturnValueOnce(null);

    await expect(
      createTrainerSignupFeeHoldPaymentIntents({
        trainerId: "trainer_1",
        email: "coach@example.com",
        pricingMode: "FOUNDING_BG_SURCHARGE_20PCT",
      }),
    ).rejects.toThrow("STRIPE_SECRET_KEY is not configured.");
  });

  it("throws when Stripe omits a client secret", async () => {
    mockPaymentIntentsCreate.mockResolvedValueOnce({
      id: "pi_bg_2",
      client_secret: null,
    });

    await expect(
      createTrainerSignupFeeHoldPaymentIntents({
        trainerId: "trainer_1",
        email: "coach@example.com",
        pricingMode: "STANDARD_100_MINUS_BG",
      }),
    ).rejects.toThrow("Stripe did not return a client secret for this payment.");
  });

  it("keeps legacy single-intent helper mapped to platform hold intent", async () => {
    mockPaymentIntentsCreate
      .mockResolvedValueOnce({
        id: "pi_bg_3",
        client_secret: "cs_bg_3",
      })
      .mockResolvedValueOnce({
        id: "pi_platform_3",
        client_secret: "cs_platform_3",
      });

    const legacy = await createTrainerSignupFeeHoldPaymentIntent({
      trainerId: "trainer_1",
      email: "coach@example.com",
      pricingMode: "STANDARD_100_MINUS_BG",
    });

    expect(legacy).toEqual({
      clientSecret: "cs_platform_3",
      paymentIntentId: "pi_platform_3",
      baseCents: 5880,
      totalCents: 6880,
    });
  });
});
