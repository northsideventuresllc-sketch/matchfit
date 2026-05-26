import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetSessionTrainerId,
  mockTrainerFindUnique,
  mockTrainerProfileFindUnique,
  mockCreateTrainerBackgroundCheckPaymentIntent,
  mockConfirmTrainerBackgroundCheckPaymentIntent,
  mockPublicApiErrorFromUnknown,
} = vi.hoisted(() => ({
  mockGetSessionTrainerId: vi.fn(),
  mockTrainerFindUnique: vi.fn(),
  mockTrainerProfileFindUnique: vi.fn(),
  mockCreateTrainerBackgroundCheckPaymentIntent: vi.fn(),
  mockConfirmTrainerBackgroundCheckPaymentIntent: vi.fn(),
  mockPublicApiErrorFromUnknown: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  getSessionTrainerId: mockGetSessionTrainerId,
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

vi.mock("@/lib/trainer-background-check-stripe", () => ({
  createTrainerBackgroundCheckPaymentIntent: mockCreateTrainerBackgroundCheckPaymentIntent,
  confirmTrainerBackgroundCheckPaymentIntent: mockConfirmTrainerBackgroundCheckPaymentIntent,
}));

vi.mock("@/lib/public-api-error", () => ({
  publicApiErrorFromUnknown: mockPublicApiErrorFromUnknown,
}));

import { POST as postCreatePaymentIntent, dynamic as createPaymentIntentDynamic } from "@/app/api/trainer/onboarding/create-payment-intent/route";
import { POST as postConfirmBackgroundPayment, dynamic as confirmBackgroundPaymentDynamic } from "@/app/api/trainer/onboarding/confirm-background-payment/route";

function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("trainer background-check payment routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetSessionTrainerId.mockResolvedValue("trainer_1");
    mockTrainerFindUnique.mockResolvedValue({
      email: "coach@example.com",
      deidentifiedAt: null,
    });
    mockTrainerProfileFindUnique.mockResolvedValue({
      hasPaidBackgroundFee: false,
    });
    mockCreateTrainerBackgroundCheckPaymentIntent.mockResolvedValue({
      clientSecret: "pi_secret_123",
      paymentIntentId: "pi_test_123",
    });
    mockConfirmTrainerBackgroundCheckPaymentIntent.mockResolvedValue(undefined);
    mockPublicApiErrorFromUnknown.mockReturnValue({
      message: "Could not start payment.",
      status: 500,
    });
  });

  it("keeps both payment routes dynamic", () => {
    expect(createPaymentIntentDynamic).toBe("force-dynamic");
    expect(confirmBackgroundPaymentDynamic).toBe("force-dynamic");
  });

  it("returns 401 when creating a payment intent without an authenticated trainer", async () => {
    mockGetSessionTrainerId.mockResolvedValueOnce(null);

    const response = await postCreatePaymentIntent();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized." });
    expect(mockTrainerFindUnique).not.toHaveBeenCalled();
  });

  it("returns 401 when the trainer record is missing or deidentified", async () => {
    mockTrainerFindUnique.mockResolvedValueOnce(null);
    const missingTrainerResponse = await postCreatePaymentIntent();

    expect(missingTrainerResponse.status).toBe(401);
    await expect(missingTrainerResponse.json()).resolves.toEqual({ error: "Unauthorized." });

    mockTrainerFindUnique.mockResolvedValueOnce({
      email: "coach@example.com",
      deidentifiedAt: new Date("2026-05-01T00:00:00.000Z"),
    });
    const deidentifiedTrainerResponse = await postCreatePaymentIntent();

    expect(deidentifiedTrainerResponse.status).toBe(401);
    await expect(deidentifiedTrainerResponse.json()).resolves.toEqual({ error: "Unauthorized." });
  });

  it("returns 400 when the trainer already paid the background check fee", async () => {
    mockTrainerProfileFindUnique.mockResolvedValueOnce({
      hasPaidBackgroundFee: true,
    });

    const response = await postCreatePaymentIntent();

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Background check fee already paid.",
    });
    expect(mockCreateTrainerBackgroundCheckPaymentIntent).not.toHaveBeenCalled();
  });

  it("returns payment-intent data for eligible trainers", async () => {
    const response = await postCreatePaymentIntent();

    expect(mockCreateTrainerBackgroundCheckPaymentIntent).toHaveBeenCalledWith({
      trainerId: "trainer_1",
      email: "coach@example.com",
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      clientSecret: "pi_secret_123",
      paymentIntentId: "pi_test_123",
    });
  });

  it("returns 503 when Stripe is not configured for create-payment-intent", async () => {
    mockCreateTrainerBackgroundCheckPaymentIntent.mockRejectedValueOnce(new Error("STRIPE_SECRET_KEY is not configured."));

    const response = await postCreatePaymentIntent();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "STRIPE_SECRET_KEY is not configured.",
    });
  });

  it("maps create-payment-intent failures with publicApiErrorFromUnknown", async () => {
    const failure = new Error("network timeout");
    mockCreateTrainerBackgroundCheckPaymentIntent.mockRejectedValueOnce(failure);
    mockPublicApiErrorFromUnknown.mockReturnValueOnce({
      message: "Could not start payment.",
      status: 502,
    });

    const response = await postCreatePaymentIntent();

    expect(mockPublicApiErrorFromUnknown).toHaveBeenCalledWith(
      failure,
      "Could not start payment.",
      { logLabel: "[trainer background check payment intent]" },
    );
    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ error: "Could not start payment." });
  });

  it("returns 401 when confirming payment without an authenticated trainer", async () => {
    mockGetSessionTrainerId.mockResolvedValueOnce(null);

    const response = await postConfirmBackgroundPayment(
      jsonRequest("https://example.test/api/trainer/onboarding/confirm-background-payment", {
        paymentIntentId: "pi_test_123",
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized." });
    expect(mockConfirmTrainerBackgroundCheckPaymentIntent).not.toHaveBeenCalled();
  });

  it("returns 400 when confirm-payment body is missing paymentIntentId", async () => {
    const response = await postConfirmBackgroundPayment(
      jsonRequest("https://example.test/api/trainer/onboarding/confirm-background-payment", {}),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "paymentIntentId is required." });
    expect(mockConfirmTrainerBackgroundCheckPaymentIntent).not.toHaveBeenCalled();
  });

  it("returns 400 when confirm-payment receives invalid JSON", async () => {
    const response = await postConfirmBackgroundPayment(
      new Request("https://example.test/api/trainer/onboarding/confirm-background-payment", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "paymentIntentId is required." });
    expect(mockConfirmTrainerBackgroundCheckPaymentIntent).not.toHaveBeenCalled();
  });

  it("trims paymentIntentId and confirms payment for authenticated trainers", async () => {
    const response = await postConfirmBackgroundPayment(
      jsonRequest("https://example.test/api/trainer/onboarding/confirm-background-payment", {
        paymentIntentId: "  pi_test_123  ",
      }),
    );

    expect(mockConfirmTrainerBackgroundCheckPaymentIntent).toHaveBeenCalledWith({
      trainerId: "trainer_1",
      paymentIntentId: "pi_test_123",
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("returns 503 when Stripe is not configured for confirm-background-payment", async () => {
    mockConfirmTrainerBackgroundCheckPaymentIntent.mockRejectedValueOnce(new Error("STRIPE_SECRET_KEY is not configured."));

    const response = await postConfirmBackgroundPayment(
      jsonRequest("https://example.test/api/trainer/onboarding/confirm-background-payment", {
        paymentIntentId: "pi_test_123",
      }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "STRIPE_SECRET_KEY is not configured.",
    });
  });

  it("maps confirm-background-payment failures with publicApiErrorFromUnknown", async () => {
    const failure = new Error("confirm failed");
    mockConfirmTrainerBackgroundCheckPaymentIntent.mockRejectedValueOnce(failure);
    mockPublicApiErrorFromUnknown.mockReturnValueOnce({
      message: "Could not confirm payment.",
      status: 422,
    });

    const response = await postConfirmBackgroundPayment(
      jsonRequest("https://example.test/api/trainer/onboarding/confirm-background-payment", {
        paymentIntentId: "pi_test_123",
      }),
    );

    expect(mockPublicApiErrorFromUnknown).toHaveBeenCalledWith(
      failure,
      "Could not confirm payment.",
      { logLabel: "[trainer confirm background payment]" },
    );
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({ error: "Could not confirm payment." });
  });
});
