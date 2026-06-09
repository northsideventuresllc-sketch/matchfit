import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockTrainerProfileFindUnique,
  mockGetSessionTrainerId,
  mockApplyTrainerSignupBackgroundEscrowHoldAuthorized,
  mockApplyTrainerSignupPlatformHoldAuthorized,
  mockResolveTrainerSignupNextPath,
  mockIsTrainerSignupBackgroundEscrowPaymentIntent,
  mockIsTrainerSignupPlatformHoldPaymentIntent,
  mockRetrieveTrainerSignupPaymentIntent,
  mockTrainerSignupPaymentIntentReady,
  mockGetStripe,
  mockPublicApiErrorFromUnknown,
} = vi.hoisted(() => ({
  mockTrainerProfileFindUnique: vi.fn(),
  mockGetSessionTrainerId: vi.fn(),
  mockApplyTrainerSignupBackgroundEscrowHoldAuthorized: vi.fn(),
  mockApplyTrainerSignupPlatformHoldAuthorized: vi.fn(),
  mockResolveTrainerSignupNextPath: vi.fn(),
  mockIsTrainerSignupBackgroundEscrowPaymentIntent: vi.fn(),
  mockIsTrainerSignupPlatformHoldPaymentIntent: vi.fn(),
  mockRetrieveTrainerSignupPaymentIntent: vi.fn(),
  mockTrainerSignupPaymentIntentReady: vi.fn(),
  mockGetStripe: vi.fn(),
  mockPublicApiErrorFromUnknown: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainerProfile: {
      findUnique: mockTrainerProfileFindUnique,
    },
  },
}));

vi.mock("@/lib/session", () => ({
  getSessionTrainerId: mockGetSessionTrainerId,
}));

vi.mock("@/lib/trainer-compliance-window-sync", () => ({
  applyTrainerSignupBackgroundEscrowHoldAuthorized: mockApplyTrainerSignupBackgroundEscrowHoldAuthorized,
  applyTrainerSignupPlatformHoldAuthorized: mockApplyTrainerSignupPlatformHoldAuthorized,
}));

vi.mock("@/lib/trainer-signup-next-path", () => ({
  resolveTrainerSignupNextPath: mockResolveTrainerSignupNextPath,
}));

vi.mock("@/lib/trainer-signup-fee-hold", () => ({
  isTrainerSignupBackgroundEscrowPaymentIntent: mockIsTrainerSignupBackgroundEscrowPaymentIntent,
  isTrainerSignupPlatformHoldPaymentIntent: mockIsTrainerSignupPlatformHoldPaymentIntent,
  retrieveTrainerSignupPaymentIntent: mockRetrieveTrainerSignupPaymentIntent,
  trainerSignupPaymentIntentReady: mockTrainerSignupPaymentIntentReady,
}));

vi.mock("@/lib/stripe-server", () => ({
  getStripe: mockGetStripe,
}));

vi.mock("@/lib/public-api-error", () => ({
  publicApiErrorFromUnknown: mockPublicApiErrorFromUnknown,
}));

import { POST as postConfirmBackgroundEscrow } from "@/app/api/trainer/signup/confirm-background-escrow/route";
import { POST as postConfirmPlatformHold } from "@/app/api/trainer/signup/confirm-platform-hold/route";
import {
  POST as postRetrieveBackgroundEscrowIntent,
  dynamic as retrieveBackgroundEscrowIntentDynamic,
} from "@/app/api/trainer/signup/retrieve-background-escrow-intent/route";

function jsonPost(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("trainer signup background escrow routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSessionTrainerId.mockResolvedValue("trainer_1");
    mockGetStripe.mockReturnValue({});
    mockRetrieveTrainerSignupPaymentIntent.mockResolvedValue({
      id: "pi_signup_hold_1",
      amount: 5880,
      client_secret: "cs_signup_hold_1",
      metadata: {
        trainerId: "trainer_1",
        pricingMode: "FOUNDING_BG_SURCHARGE_20PCT",
      },
    });
    mockIsTrainerSignupBackgroundEscrowPaymentIntent.mockReturnValue(true);
    mockIsTrainerSignupPlatformHoldPaymentIntent.mockReturnValue(true);
    mockTrainerSignupPaymentIntentReady.mockReturnValue(true);
    mockTrainerProfileFindUnique.mockResolvedValue({
      hasSignedTOS: true,
      registrationFeeHoldStatus: "HELD",
      hasPaidRegistrationFee: false,
      limitedDashboardUnlockedAt: null,
      onboardingFeePaymentDeadlineAt: null,
      onboardingFeePaymentExpiredAt: null,
    });
    mockResolveTrainerSignupNextPath.mockReturnValue("/trainer/signup/payment");
    mockPublicApiErrorFromUnknown.mockReturnValue({
      message: "Could not confirm payment.",
      status: 500,
    });
  });

  it("returns 401 for confirm-background-escrow when trainer session is missing", async () => {
    mockGetSessionTrainerId.mockResolvedValueOnce(null);

    const res = await postConfirmBackgroundEscrow(
      jsonPost("https://example.test/api/trainer/signup/confirm-background-escrow", {
        paymentIntentId: "pi_bg_1",
      }),
    );

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "Unauthorized." });
    expect(mockRetrieveTrainerSignupPaymentIntent).not.toHaveBeenCalled();
  });

  it("validates confirm-background-escrow request payload", async () => {
    const res = await postConfirmBackgroundEscrow(
      jsonPost("https://example.test/api/trainer/signup/confirm-background-escrow", {}),
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Payment intent id is required." });
  });

  it("guards confirm-background-escrow on payment ownership and readiness", async () => {
    mockRetrieveTrainerSignupPaymentIntent.mockResolvedValueOnce({
      id: "pi_other",
      metadata: { trainerId: "trainer_other" },
    });

    const ownerRes = await postConfirmBackgroundEscrow(
      jsonPost("https://example.test/api/trainer/signup/confirm-background-escrow", {
        paymentIntentId: "pi_other",
      }),
    );
    expect(ownerRes.status).toBe(403);
    await expect(ownerRes.json()).resolves.toEqual({
      error: "Payment does not belong to this account.",
    });

    mockRetrieveTrainerSignupPaymentIntent.mockResolvedValueOnce({
      id: "pi_pending",
      metadata: { trainerId: "trainer_1" },
    });
    mockTrainerSignupPaymentIntentReady.mockReturnValueOnce(false);
    const pendingRes = await postConfirmBackgroundEscrow(
      jsonPost("https://example.test/api/trainer/signup/confirm-background-escrow", {
        paymentIntentId: "pi_pending",
      }),
    );
    expect(pendingRes.status).toBe(400);
    await expect(pendingRes.json()).resolves.toEqual({
      error: "Payment has not completed yet.",
    });
  });

  it("confirms background escrow and returns the resolved next path", async () => {
    const res = await postConfirmBackgroundEscrow(
      jsonPost("https://example.test/api/trainer/signup/confirm-background-escrow", {
        paymentIntentId: "pi_bg_1",
      }),
    );

    expect(mockApplyTrainerSignupBackgroundEscrowHoldAuthorized).toHaveBeenCalledWith({
      trainerId: "trainer_1",
      paymentIntentId: "pi_signup_hold_1",
    });
    expect(mockResolveTrainerSignupNextPath).toHaveBeenCalledWith({
      hasSignedTOS: true,
      registrationFeeHoldStatus: "HELD",
      hasPaidRegistrationFee: false,
      limitedDashboardUnlockedAt: null,
      onboardingFeePaymentDeadlineAt: null,
      onboardingFeePaymentExpiredAt: null,
    });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      ok: true,
      next: "/trainer/signup/payment",
    });
  });

  it("maps confirm-background-escrow failures through publicApiErrorFromUnknown", async () => {
    const failure = new Error("stripe timeout");
    mockRetrieveTrainerSignupPaymentIntent.mockRejectedValueOnce(failure);
    mockPublicApiErrorFromUnknown.mockReturnValueOnce({
      message: "Could not confirm payment.",
      status: 502,
    });

    const res = await postConfirmBackgroundEscrow(
      jsonPost("https://example.test/api/trainer/signup/confirm-background-escrow", {
        paymentIntentId: "pi_bg_1",
      }),
    );

    expect(mockPublicApiErrorFromUnknown).toHaveBeenCalledWith(failure, "Could not confirm payment.", {
      logLabel: "[trainer signup confirm background escrow]",
    });
    expect(res.status).toBe(502);
    await expect(res.json()).resolves.toEqual({ error: "Could not confirm payment." });
  });

  it("confirms platform hold and defaults pricing mode + paid cents safely", async () => {
    mockRetrieveTrainerSignupPaymentIntent.mockResolvedValueOnce({
      id: "pi_platform_1",
      metadata: {
        trainerId: "trainer_1",
        pricingMode: "UNRECOGNIZED",
      },
    });
    mockTrainerProfileFindUnique.mockResolvedValueOnce({
      registrationFeeHoldStatus: "HELD",
    });

    const res = await postConfirmPlatformHold(
      jsonPost("https://example.test/api/trainer/signup/confirm-platform-hold", {
        paymentIntentId: "pi_platform_1",
        backgroundCheckPaymentIntentId: "pi_bg_1",
      }),
    );

    expect(mockApplyTrainerSignupPlatformHoldAuthorized).toHaveBeenCalledWith({
      trainerId: "trainer_1",
      paymentIntentId: "pi_platform_1",
      pendingBackgroundCheckEscrowPaymentIntentId: "pi_bg_1",
      paidCents: 0,
      pricingMode: "FOUNDING_BG_SURCHARGE_20PCT",
    });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      ok: true,
      registrationFeeHoldStatus: "HELD",
    });
  });

  it("uses STANDARD_100_MINUS_BG pricing mode when metadata explicitly matches", async () => {
    mockRetrieveTrainerSignupPaymentIntent.mockResolvedValueOnce({
      id: "pi_platform_standard",
      amount: 10_000,
      metadata: {
        trainerId: "trainer_1",
        pricingMode: "STANDARD_100_MINUS_BG",
      },
    });
    mockTrainerProfileFindUnique.mockResolvedValueOnce({
      registrationFeeHoldStatus: null,
    });

    const res = await postConfirmPlatformHold(
      jsonPost("https://example.test/api/trainer/signup/confirm-platform-hold", {
        paymentIntentId: "pi_platform_standard",
        backgroundCheckPaymentIntentId: "pi_bg_2",
      }),
    );

    expect(mockApplyTrainerSignupPlatformHoldAuthorized).toHaveBeenCalledWith({
      trainerId: "trainer_1",
      paymentIntentId: "pi_platform_standard",
      pendingBackgroundCheckEscrowPaymentIntentId: "pi_bg_2",
      paidCents: 10_000,
      pricingMode: "STANDARD_100_MINUS_BG",
    });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      ok: true,
      registrationFeeHoldStatus: null,
    });
  });

  it("exports force-dynamic mode and retrieves pending background escrow client secret", async () => {
    mockTrainerProfileFindUnique.mockResolvedValueOnce({
      backgroundCheckEscrowPaymentIntentId: "  pi_bg_escrow_1  ",
      backgroundCheckEscrowHoldStatus: "NOT_STARTED",
    });
    mockRetrieveTrainerSignupPaymentIntent.mockResolvedValueOnce({
      id: "pi_bg_escrow_1",
      amount: 4900,
      client_secret: "cs_bg_escrow_1",
      metadata: { trainerId: "trainer_1" },
    });

    expect(retrieveBackgroundEscrowIntentDynamic).toBe("force-dynamic");

    const res = await postRetrieveBackgroundEscrowIntent();

    expect(mockRetrieveTrainerSignupPaymentIntent).toHaveBeenCalledWith("pi_bg_escrow_1");
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      clientSecret: "cs_bg_escrow_1",
      paymentIntentId: "pi_bg_escrow_1",
      amountCents: 4900,
    });
  });

  it("returns descriptive retrieve-background-escrow-intent validation errors", async () => {
    mockTrainerProfileFindUnique.mockResolvedValueOnce({
      backgroundCheckEscrowPaymentIntentId: "   ",
      backgroundCheckEscrowHoldStatus: "NOT_STARTED",
    });
    const noPendingRes = await postRetrieveBackgroundEscrowIntent();
    expect(noPendingRes.status).toBe(400);
    await expect(noPendingRes.json()).resolves.toEqual({
      error: "No background check authorization is pending.",
    });

    mockTrainerProfileFindUnique.mockResolvedValueOnce({
      backgroundCheckEscrowPaymentIntentId: "pi_bg_done",
      backgroundCheckEscrowHoldStatus: "  held ",
    });
    const alreadyHeldRes = await postRetrieveBackgroundEscrowIntent();
    expect(alreadyHeldRes.status).toBe(400);
    await expect(alreadyHeldRes.json()).resolves.toEqual({
      error: "Background check authorization is already complete.",
    });
  });

  it("maps retrieve-background-escrow-intent failures through publicApiErrorFromUnknown", async () => {
    const failure = new Error("db unavailable");
    mockTrainerProfileFindUnique.mockRejectedValueOnce(failure);
    mockPublicApiErrorFromUnknown.mockReturnValueOnce({
      message: "Could not load authorization.",
      status: 503,
    });

    const res = await postRetrieveBackgroundEscrowIntent();

    expect(mockPublicApiErrorFromUnknown).toHaveBeenCalledWith(failure, "Could not load authorization.", {
      logLabel: "[trainer signup retrieve background escrow]",
    });
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({ error: "Could not load authorization." });
  });
});
