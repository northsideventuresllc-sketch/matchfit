import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockHydrateStripeEnvFromDatabase,
  mockGetSessionTrainerId,
  mockIsStripeSecretConfigured,
  mockTrainerFindUnique,
  mockTrainerProfileFindUnique,
  mockCreateTrainerSignupFeeHoldPaymentIntents,
  mockRetrieveTrainerSignupPaymentIntent,
  mockIsTrainerSignupPlatformHoldPaymentIntent,
  mockIsTrainerSignupBackgroundEscrowPaymentIntent,
  mockTrainerSignupPaymentIntentReady,
  mockApplyTrainerSignupFeeHoldAuthorized,
  mockApplyTrainerSignupPlatformHoldAuthorized,
  mockApplyTrainerSignupBackgroundEscrowHoldAuthorized,
  mockResolveTrainerSignupNextPath,
  mockPublicApiErrorFromUnknown,
  mockComputeTrainerSignupCombinedHoldCents,
  mockGetStripe,
  mockCheckoutSessionsRetrieve,
} = vi.hoisted(() => ({
  mockHydrateStripeEnvFromDatabase: vi.fn(),
  mockGetSessionTrainerId: vi.fn(),
  mockIsStripeSecretConfigured: vi.fn(),
  mockTrainerFindUnique: vi.fn(),
  mockTrainerProfileFindUnique: vi.fn(),
  mockCreateTrainerSignupFeeHoldPaymentIntents: vi.fn(),
  mockRetrieveTrainerSignupPaymentIntent: vi.fn(),
  mockIsTrainerSignupPlatformHoldPaymentIntent: vi.fn(),
  mockIsTrainerSignupBackgroundEscrowPaymentIntent: vi.fn(),
  mockTrainerSignupPaymentIntentReady: vi.fn(),
  mockApplyTrainerSignupFeeHoldAuthorized: vi.fn(),
  mockApplyTrainerSignupPlatformHoldAuthorized: vi.fn(),
  mockApplyTrainerSignupBackgroundEscrowHoldAuthorized: vi.fn(),
  mockResolveTrainerSignupNextPath: vi.fn(),
  mockPublicApiErrorFromUnknown: vi.fn(),
  mockComputeTrainerSignupCombinedHoldCents: vi.fn(),
  mockGetStripe: vi.fn(),
  mockCheckoutSessionsRetrieve: vi.fn(),
}));

vi.mock("@/lib/hydrate-stripe-env", () => ({
  hydrateStripeEnvFromDatabase: mockHydrateStripeEnvFromDatabase,
}));

vi.mock("@/lib/session", () => ({
  getSessionTrainerId: mockGetSessionTrainerId,
}));

vi.mock("@/lib/stripe-config", () => ({
  isStripeSecretConfigured: mockIsStripeSecretConfigured,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainer: {
      findUnique: mockTrainerFindUnique,
    },
    trainerProfile: {
      findUnique: mockTrainerProfileFindUnique,
    },
  },
}));

vi.mock("@/lib/trainer-signup-fee-hold", () => ({
  createTrainerSignupFeeHoldPaymentIntents: mockCreateTrainerSignupFeeHoldPaymentIntents,
  retrieveTrainerSignupPaymentIntent: mockRetrieveTrainerSignupPaymentIntent,
  isTrainerSignupPlatformHoldPaymentIntent: mockIsTrainerSignupPlatformHoldPaymentIntent,
  isTrainerSignupBackgroundEscrowPaymentIntent: mockIsTrainerSignupBackgroundEscrowPaymentIntent,
  trainerSignupPaymentIntentReady: mockTrainerSignupPaymentIntentReady,
  TRAINER_SIGNUP_BG_ESCROW_PURPOSE: "trainer_signup_bg_escrow",
  TRAINER_SIGNUP_PLATFORM_HOLD_PURPOSE: "trainer_signup_platform_hold",
}));

vi.mock("@/lib/trainer-compliance-window-sync", () => ({
  applyTrainerSignupFeeHoldAuthorized: mockApplyTrainerSignupFeeHoldAuthorized,
  applyTrainerSignupPlatformHoldAuthorized: mockApplyTrainerSignupPlatformHoldAuthorized,
  applyTrainerSignupBackgroundEscrowHoldAuthorized: mockApplyTrainerSignupBackgroundEscrowHoldAuthorized,
}));

vi.mock("@/lib/trainer-signup-next-path", () => ({
  resolveTrainerSignupNextPath: mockResolveTrainerSignupNextPath,
}));

vi.mock("@/lib/public-api-error", () => ({
  publicApiErrorFromUnknown: mockPublicApiErrorFromUnknown,
}));

vi.mock("@/lib/trainer-signup-escrow", () => ({
  computeTrainerSignupCombinedHoldCents: mockComputeTrainerSignupCombinedHoldCents,
}));

vi.mock("@/lib/stripe-server", () => ({
  getStripe: mockGetStripe,
}));

import {
  POST as postCreatePaymentIntent,
  dynamic as createPaymentIntentDynamic,
} from "@/app/api/trainer/signup/create-payment-intent/route";
import {
  POST as postConfirmBackgroundEscrow,
} from "@/app/api/trainer/signup/confirm-background-escrow/route";
import {
  POST as postRetrieveBackgroundEscrowIntent,
  dynamic as retrieveBackgroundEscrowIntentDynamic,
} from "@/app/api/trainer/signup/retrieve-background-escrow-intent/route";
import { POST as postConfirmPlatformHold } from "@/app/api/trainer/signup/confirm-platform-hold/route";
import { POST as postConfirmCheckoutSession } from "@/app/api/trainer/signup/confirm-checkout-session/route";
import { POST as postConfirmPayment } from "@/app/api/trainer/signup/confirm-payment/route";

function jsonPost(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("trainer signup payment routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockHydrateStripeEnvFromDatabase.mockResolvedValue(undefined);
    mockGetSessionTrainerId.mockResolvedValue("trainer_1");
    mockIsStripeSecretConfigured.mockReturnValue(true);

    mockGetStripe.mockReturnValue({
      checkout: {
        sessions: {
          retrieve: mockCheckoutSessionsRetrieve,
        },
      },
    });

    mockTrainerFindUnique.mockResolvedValue({
      email: "trainer@example.com",
      deidentifiedAt: null,
    });

    mockTrainerProfileFindUnique.mockResolvedValue({
      hasSignedTOS: true,
      registrationFeeHoldStatus: "NOT_STARTED",
      backgroundCheckEscrowHoldStatus: "NOT_STARTED",
      hasPaidRegistrationFee: false,
      registrationFeePricingMode: "FOUNDING_BG_SURCHARGE_20PCT",
      onboardingFeePaymentDeadlineAt: null,
      onboardingFeePaymentExpiredAt: null,
      limitedDashboardUnlockedAt: null,
    });

    mockCreateTrainerSignupFeeHoldPaymentIntents.mockResolvedValue({
      platformClientSecret: "cs_platform",
      platformPaymentIntentId: "pi_platform",
      backgroundCheckClientSecret: "cs_bg",
      backgroundCheckPaymentIntentId: "pi_bg",
      baseCents: 5880,
      totalCents: 6880,
      platformHoldCents: 1980,
      backgroundCheckHoldCents: 4900,
    });

    mockRetrieveTrainerSignupPaymentIntent.mockResolvedValue({
      id: "pi_platform",
      amount: 1980,
      client_secret: "cs_test",
      status: "requires_capture",
      metadata: {
        purpose: "trainer_signup_platform_hold",
        trainerId: "trainer_1",
        pricingMode: "FOUNDING_BG_SURCHARGE_20PCT",
      },
    });

    mockIsTrainerSignupPlatformHoldPaymentIntent.mockImplementation(
      (pi: { metadata?: Record<string, string> | null }) =>
        (pi.metadata?.purpose ?? "").includes("platform") || pi.metadata?.purpose === "trainer_signup_fee_hold",
    );
    mockIsTrainerSignupBackgroundEscrowPaymentIntent.mockImplementation(
      (pi: { metadata?: Record<string, string> | null }) => pi.metadata?.purpose === "trainer_signup_bg_escrow",
    );
    mockTrainerSignupPaymentIntentReady.mockImplementation(
      (pi: { status: string }) => pi.status === "requires_capture" || pi.status === "succeeded",
    );

    mockResolveTrainerSignupNextPath.mockReturnValue("/trainer/dashboard");
    mockComputeTrainerSignupCombinedHoldCents.mockReturnValue(6880);
    mockPublicApiErrorFromUnknown.mockReturnValue({
      message: "Could not confirm payment.",
      status: 500,
    });

    mockCheckoutSessionsRetrieve.mockResolvedValue({
      metadata: {
        purpose: "trainer_signup_platform_hold",
        trainerId: "trainer_1",
        backgroundCheckPaymentIntentId: "pi_bg_pending",
      },
      payment_intent: "pi_platform",
    });
  });

  it("exports force-dynamic mode where required", () => {
    expect(createPaymentIntentDynamic).toBe("force-dynamic");
    expect(retrieveBackgroundEscrowIntentDynamic).toBe("force-dynamic");
  });

  it("returns 401 from create-payment-intent when session is missing", async () => {
    mockGetSessionTrainerId.mockResolvedValueOnce(null);

    const res = await postCreatePaymentIntent();

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "Unauthorized." });
  });

  it("returns 503 from create-payment-intent when billing is unavailable", async () => {
    mockIsStripeSecretConfigured.mockReturnValueOnce(false);

    const res = await postCreatePaymentIntent();

    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({ error: "Billing is not configured." });
  });

  it("returns 400 from create-payment-intent when trainer has not signed terms", async () => {
    mockTrainerProfileFindUnique.mockResolvedValueOnce({
      hasSignedTOS: false,
      registrationFeeHoldStatus: "NOT_STARTED",
      backgroundCheckEscrowHoldStatus: "NOT_STARTED",
      hasPaidRegistrationFee: false,
      registrationFeePricingMode: "FOUNDING_BG_SURCHARGE_20PCT",
    });

    const res = await postCreatePaymentIntent();

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: "Accept the trainer agreement before payment.",
    });
  });

  it("returns 400 from create-payment-intent when signup fee is already authorized", async () => {
    mockTrainerProfileFindUnique.mockResolvedValueOnce({
      hasSignedTOS: true,
      registrationFeeHoldStatus: "HELD",
      backgroundCheckEscrowHoldStatus: "NOT_STARTED",
      hasPaidRegistrationFee: false,
      registrationFeePricingMode: "FOUNDING_BG_SURCHARGE_20PCT",
    });

    const res = await postCreatePaymentIntent();

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Signup fee already authorized." });
  });

  it("creates signup payment intents and returns escrow breakdown", async () => {
    mockTrainerProfileFindUnique.mockResolvedValueOnce({
      hasSignedTOS: true,
      registrationFeeHoldStatus: "NOT_STARTED",
      backgroundCheckEscrowHoldStatus: "NOT_STARTED",
      hasPaidRegistrationFee: false,
      registrationFeePricingMode: "STANDARD_100_MINUS_BG",
    });

    const res = await postCreatePaymentIntent();

    expect(mockCreateTrainerSignupFeeHoldPaymentIntents).toHaveBeenCalledWith({
      trainerId: "trainer_1",
      email: "trainer@example.com",
      pricingMode: "STANDARD_100_MINUS_BG",
    });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      clientSecret: "cs_platform",
      paymentIntentId: "pi_platform",
      backgroundCheckClientSecret: "cs_bg",
      backgroundCheckPaymentIntentId: "pi_bg",
      baseCents: 5880,
      totalCents: 6880,
      platformHoldCents: 1980,
      backgroundCheckHoldCents: 4900,
      pricingMode: "STANDARD_100_MINUS_BG",
    });
  });

  it("maps unexpected create-payment-intent failures via publicApiErrorFromUnknown", async () => {
    const failure = new Error("database offline");
    mockTrainerFindUnique.mockRejectedValueOnce(failure);
    mockPublicApiErrorFromUnknown.mockReturnValueOnce({
      message: "Could not start payment.",
      status: 502,
    });

    const res = await postCreatePaymentIntent();

    expect(mockPublicApiErrorFromUnknown).toHaveBeenCalledWith(failure, "Could not start payment.", {
      logLabel: "[trainer signup payment intent]",
    });
    expect(res.status).toBe(502);
    await expect(res.json()).resolves.toEqual({ error: "Could not start payment." });
  });

  it("returns 400 from confirm-background-escrow for invalid payload", async () => {
    const res = await postConfirmBackgroundEscrow(
      jsonPost("https://example.test/api/trainer/signup/confirm-background-escrow", {}),
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Payment intent id is required." });
  });

  it("confirms background escrow and returns next step", async () => {
    mockRetrieveTrainerSignupPaymentIntent.mockResolvedValueOnce({
      id: "pi_bg",
      status: "requires_capture",
      metadata: {
        purpose: "trainer_signup_bg_escrow",
        trainerId: "trainer_1",
      },
    });

    const res = await postConfirmBackgroundEscrow(
      jsonPost("https://example.test/api/trainer/signup/confirm-background-escrow", {
        paymentIntentId: "pi_bg",
      }),
    );

    expect(mockApplyTrainerSignupBackgroundEscrowHoldAuthorized).toHaveBeenCalledWith({
      trainerId: "trainer_1",
      paymentIntentId: "pi_bg",
    });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      ok: true,
      next: "/trainer/dashboard",
    });
  });

  it("returns 400 from retrieve-background-escrow-intent when no pending authorization exists", async () => {
    mockTrainerProfileFindUnique.mockResolvedValueOnce({
      backgroundCheckEscrowPaymentIntentId: null,
      backgroundCheckEscrowHoldStatus: "NOT_STARTED",
    });

    const res = await postRetrieveBackgroundEscrowIntent();

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: "No background check authorization is pending.",
    });
  });

  it("returns pending background escrow intent details for trainer", async () => {
    mockTrainerProfileFindUnique.mockResolvedValueOnce({
      backgroundCheckEscrowPaymentIntentId: "pi_bg_pending",
      backgroundCheckEscrowHoldStatus: "NOT_STARTED",
    });
    mockRetrieveTrainerSignupPaymentIntent.mockResolvedValueOnce({
      id: "pi_bg_pending",
      amount: 4900,
      client_secret: "cs_bg_pending",
      metadata: {
        purpose: "trainer_signup_bg_escrow",
        trainerId: "trainer_1",
      },
    });

    const res = await postRetrieveBackgroundEscrowIntent();

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      clientSecret: "cs_bg_pending",
      paymentIntentId: "pi_bg_pending",
      amountCents: 4900,
    });
  });

  it("returns 400 from confirm-platform-hold when payload is invalid", async () => {
    const res = await postConfirmPlatformHold(
      jsonPost("https://example.test/api/trainer/signup/confirm-platform-hold", {
        paymentIntentId: "pi_platform",
      }),
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Payment intent ids are required." });
  });

  it("confirms platform hold and persists pending background intent id", async () => {
    mockRetrieveTrainerSignupPaymentIntent.mockResolvedValueOnce({
      id: "pi_platform",
      amount: 1980,
      status: "requires_capture",
      metadata: {
        purpose: "trainer_signup_platform_hold",
        trainerId: "trainer_1",
      },
    });
    mockTrainerProfileFindUnique.mockResolvedValueOnce({
      registrationFeeHoldStatus: "HELD",
    });

    const res = await postConfirmPlatformHold(
      jsonPost("https://example.test/api/trainer/signup/confirm-platform-hold", {
        paymentIntentId: "pi_platform",
        backgroundCheckPaymentIntentId: "pi_bg_pending",
      }),
    );

    expect(mockApplyTrainerSignupPlatformHoldAuthorized).toHaveBeenCalledWith({
      trainerId: "trainer_1",
      paymentIntentId: "pi_platform",
      pendingBackgroundCheckEscrowPaymentIntentId: "pi_bg_pending",
      paidCents: 1980,
      pricingMode: "FOUNDING_BG_SURCHARGE_20PCT",
    });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      ok: true,
      registrationFeeHoldStatus: "HELD",
    });
  });

  it("returns 400 from confirm-checkout-session when checkout purpose is invalid", async () => {
    mockCheckoutSessionsRetrieve.mockResolvedValueOnce({
      metadata: {
        purpose: "unrelated_purpose",
        trainerId: "trainer_1",
      },
      payment_intent: "pi_platform",
    });

    const res = await postConfirmCheckoutSession(
      jsonPost("https://example.test/api/trainer/signup/confirm-checkout-session", {
        sessionId: "cs_test",
      }),
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Invalid checkout session." });
  });

  it("applies platform hold from checkout and flags pending background authorization", async () => {
    mockRetrieveTrainerSignupPaymentIntent.mockResolvedValueOnce({
      id: "pi_platform",
      amount: 1980,
      status: "requires_capture",
      metadata: {
        purpose: "trainer_signup_platform_hold",
        trainerId: "trainer_1",
        pricingMode: "STANDARD_100_MINUS_BG",
      },
    });
    mockTrainerProfileFindUnique.mockResolvedValueOnce({
      hasSignedTOS: true,
      registrationFeeHoldStatus: "HELD",
      backgroundCheckEscrowHoldStatus: "NOT_STARTED",
      hasPaidRegistrationFee: false,
      limitedDashboardUnlockedAt: null,
      onboardingFeePaymentDeadlineAt: null,
      onboardingFeePaymentExpiredAt: null,
    });

    const res = await postConfirmCheckoutSession(
      jsonPost("https://example.test/api/trainer/signup/confirm-checkout-session", {
        sessionId: "cs_test",
      }),
    );

    expect(mockApplyTrainerSignupPlatformHoldAuthorized).toHaveBeenCalledWith({
      trainerId: "trainer_1",
      paymentIntentId: "pi_platform",
      pendingBackgroundCheckEscrowPaymentIntentId: "pi_bg_pending",
      paidCents: 1980,
      pricingMode: "STANDARD_100_MINUS_BG",
    });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      ok: true,
      next: "/trainer/dashboard",
      needsBackgroundCheckAuthorization: true,
      backgroundCheckPaymentIntentId: "pi_bg_pending",
    });
  });

  it("applies full fee hold from checkout when background escrow intent is confirmed", async () => {
    mockRetrieveTrainerSignupPaymentIntent
      .mockResolvedValueOnce({
        id: "pi_platform",
        amount: 1980,
        status: "requires_capture",
        metadata: {
          purpose: "trainer_signup_platform_hold",
          trainerId: "trainer_1",
          pricingMode: "FOUNDING_BG_SURCHARGE_20PCT",
        },
      })
      .mockResolvedValueOnce({
        id: "pi_bg_confirmed",
        status: "requires_capture",
        metadata: {
          purpose: "trainer_signup_bg_escrow",
          trainerId: "trainer_1",
        },
      });
    mockTrainerProfileFindUnique.mockResolvedValueOnce({
      hasSignedTOS: true,
      registrationFeeHoldStatus: "HELD",
      backgroundCheckEscrowHoldStatus: "HELD",
      hasPaidRegistrationFee: false,
      limitedDashboardUnlockedAt: null,
      onboardingFeePaymentDeadlineAt: null,
      onboardingFeePaymentExpiredAt: null,
    });

    const res = await postConfirmCheckoutSession(
      jsonPost("https://example.test/api/trainer/signup/confirm-checkout-session", {
        sessionId: "cs_test",
        backgroundCheckPaymentIntentId: "pi_bg_confirmed",
      }),
    );

    expect(mockApplyTrainerSignupFeeHoldAuthorized).toHaveBeenCalledWith({
      trainerId: "trainer_1",
      paymentIntentId: "pi_platform",
      backgroundCheckEscrowPaymentIntentId: "pi_bg_confirmed",
      paidCents: 6880,
      pricingMode: "FOUNDING_BG_SURCHARGE_20PCT",
    });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      ok: true,
      next: "/trainer/dashboard",
      needsBackgroundCheckAuthorization: false,
      backgroundCheckPaymentIntentId: "pi_bg_pending",
    });
  });

  it("returns 401 from confirm-payment when trainer session is missing", async () => {
    mockGetSessionTrainerId.mockResolvedValueOnce(null);

    const res = await postConfirmPayment(
      jsonPost("https://example.test/api/trainer/signup/confirm-payment", {
        paymentIntentId: "pi_platform",
      }),
    );

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "Unauthorized." });
  });

  it("confirms signup payment and uses combined hold cents when background escrow id is included", async () => {
    mockRetrieveTrainerSignupPaymentIntent
      .mockResolvedValueOnce({
        id: "pi_platform",
        amount: 1980,
        status: "requires_capture",
        metadata: {
          purpose: "trainer_signup_platform_hold",
          trainerId: "trainer_1",
          pricingMode: "STANDARD_100_MINUS_BG",
        },
      })
      .mockResolvedValueOnce({
        id: "pi_bg",
        status: "requires_capture",
        metadata: {
          purpose: "trainer_signup_bg_escrow",
          trainerId: "trainer_1",
        },
      });

    const res = await postConfirmPayment(
      jsonPost("https://example.test/api/trainer/signup/confirm-payment", {
        paymentIntentId: "pi_platform",
        backgroundCheckPaymentIntentId: "pi_bg",
      }),
    );

    expect(mockApplyTrainerSignupFeeHoldAuthorized).toHaveBeenCalledWith({
      trainerId: "trainer_1",
      paymentIntentId: "pi_platform",
      backgroundCheckEscrowPaymentIntentId: "pi_bg",
      paidCents: 6880,
      pricingMode: "STANDARD_100_MINUS_BG",
    });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      ok: true,
      next: "/trainer/dashboard",
    });
  });

  it("maps known confirm-payment validation errors to 400 and 403", async () => {
    mockIsTrainerSignupPlatformHoldPaymentIntent.mockReturnValueOnce(false);

    const invalidPaymentRes = await postConfirmPayment(
      jsonPost("https://example.test/api/trainer/signup/confirm-payment", {
        paymentIntentId: "pi_platform",
      }),
    );
    expect(invalidPaymentRes.status).toBe(400);
    await expect(invalidPaymentRes.json()).resolves.toEqual({ error: "Invalid payment." });

    mockRetrieveTrainerSignupPaymentIntent.mockResolvedValueOnce({
      id: "pi_platform",
      amount: 1980,
      status: "requires_capture",
      metadata: {
        purpose: "trainer_signup_platform_hold",
        trainerId: "trainer_other",
      },
    });

    const forbiddenRes = await postConfirmPayment(
      jsonPost("https://example.test/api/trainer/signup/confirm-payment", {
        paymentIntentId: "pi_platform",
      }),
    );
    expect(forbiddenRes.status).toBe(403);
    await expect(forbiddenRes.json()).resolves.toEqual({
      error: "Payment does not belong to this account.",
    });
  });

  it("maps unknown confirm-payment failures via publicApiErrorFromUnknown", async () => {
    const failure = new Error("db timeout");
    mockRetrieveTrainerSignupPaymentIntent.mockRejectedValueOnce(failure);
    mockPublicApiErrorFromUnknown.mockReturnValueOnce({
      message: "Could not confirm payment.",
      status: 502,
    });

    const res = await postConfirmPayment(
      jsonPost("https://example.test/api/trainer/signup/confirm-payment", {
        paymentIntentId: "pi_platform",
      }),
    );

    expect(mockPublicApiErrorFromUnknown).toHaveBeenCalledWith(failure, "Could not confirm payment.", {
      logLabel: "[trainer signup confirm payment]",
    });
    expect(res.status).toBe(502);
    await expect(res.json()).resolves.toEqual({ error: "Could not confirm payment." });
  });
});
