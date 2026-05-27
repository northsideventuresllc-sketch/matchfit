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

import {
  POST as postCreatePaymentIntent,
  dynamic as createPaymentIntentDynamic,
} from "@/app/api/trainer/onboarding/create-payment-intent/route";
import {
  POST as postConfirmBackgroundPayment,
  dynamic as confirmBackgroundPaymentDynamic,
} from "@/app/api/trainer/onboarding/confirm-background-payment/route";

function jsonPost(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("trainer onboarding background check payment routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSessionTrainerId.mockResolvedValue("trainer_1");
    mockTrainerFindUnique.mockResolvedValue({
      email: "trainer@example.com",
      deidentifiedAt: null,
    });
    mockTrainerProfileFindUnique.mockResolvedValue({ hasPaidBackgroundFee: false });
    mockCreateTrainerBackgroundCheckPaymentIntent.mockResolvedValue({
      clientSecret: "cs_test_123",
      paymentIntentId: "pi_123",
    });
    mockConfirmTrainerBackgroundCheckPaymentIntent.mockResolvedValue(undefined);
    mockPublicApiErrorFromUnknown.mockReturnValue({
      message: "Could not start payment.",
      status: 500,
    });
  });

  it("exports force-dynamic mode for both routes", () => {
    expect(createPaymentIntentDynamic).toBe("force-dynamic");
    expect(confirmBackgroundPaymentDynamic).toBe("force-dynamic");
  });

  describe("POST /api/trainer/onboarding/create-payment-intent", () => {
    it("returns 401 when trainer session is missing", async () => {
      mockGetSessionTrainerId.mockResolvedValueOnce(null);

      const response = await postCreatePaymentIntent();

      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toEqual({ error: "Unauthorized." });
      expect(mockTrainerFindUnique).not.toHaveBeenCalled();
    });

    it("returns 401 when trainer does not exist or is deidentified", async () => {
      mockTrainerFindUnique.mockResolvedValueOnce(null);
      const missingResponse = await postCreatePaymentIntent();
      expect(missingResponse.status).toBe(401);

      mockTrainerFindUnique.mockResolvedValueOnce({
        email: "trainer@example.com",
        deidentifiedAt: new Date("2026-05-01T00:00:00.000Z"),
      });
      const deidentifiedResponse = await postCreatePaymentIntent();
      expect(deidentifiedResponse.status).toBe(401);
      await expect(deidentifiedResponse.json()).resolves.toEqual({ error: "Unauthorized." });
    });

    it("returns 400 when trainer already paid the background-check fee", async () => {
      mockTrainerProfileFindUnique.mockResolvedValueOnce({ hasPaidBackgroundFee: true });

      const response = await postCreatePaymentIntent();

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: "Background check fee already paid.",
      });
      expect(mockCreateTrainerBackgroundCheckPaymentIntent).not.toHaveBeenCalled();
    });

    it("returns payment intent client secret for eligible trainer", async () => {
      const response = await postCreatePaymentIntent();

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        clientSecret: "cs_test_123",
        paymentIntentId: "pi_123",
      });
      expect(mockCreateTrainerBackgroundCheckPaymentIntent).toHaveBeenCalledWith({
        trainerId: "trainer_1",
        email: "trainer@example.com",
      });
    });

    it("returns 503 when Stripe server key is missing", async () => {
      mockCreateTrainerBackgroundCheckPaymentIntent.mockRejectedValueOnce(
        new Error("STRIPE_SECRET_KEY is not configured."),
      );

      const response = await postCreatePaymentIntent();

      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toEqual({
        error: "STRIPE_SECRET_KEY is not configured.",
      });
      expect(mockPublicApiErrorFromUnknown).not.toHaveBeenCalled();
    });

    it("maps unexpected create errors through publicApiErrorFromUnknown", async () => {
      const upstreamError = new Error("stripe timeout");
      mockCreateTrainerBackgroundCheckPaymentIntent.mockRejectedValueOnce(upstreamError);
      mockPublicApiErrorFromUnknown.mockReturnValueOnce({
        message: "Could not start payment.",
        status: 502,
      });

      const response = await postCreatePaymentIntent();

      expect(mockPublicApiErrorFromUnknown).toHaveBeenCalledWith(
        upstreamError,
        "Could not start payment.",
        { logLabel: "[trainer background check payment intent]" },
      );
      expect(response.status).toBe(502);
      await expect(response.json()).resolves.toEqual({ error: "Could not start payment." });
    });
  });

  describe("POST /api/trainer/onboarding/confirm-background-payment", () => {
    it("returns 401 when trainer session is missing", async () => {
      mockGetSessionTrainerId.mockResolvedValueOnce(null);

      const response = await postConfirmBackgroundPayment(
        jsonPost("https://example.test/api/trainer/onboarding/confirm-background-payment", {
          paymentIntentId: "pi_123",
        }),
      );

      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toEqual({ error: "Unauthorized." });
      expect(mockConfirmTrainerBackgroundCheckPaymentIntent).not.toHaveBeenCalled();
    });

    it("returns 400 when paymentIntentId is missing or invalid JSON", async () => {
      const missingResponse = await postConfirmBackgroundPayment(
        jsonPost("https://example.test/api/trainer/onboarding/confirm-background-payment", {}),
      );
      expect(missingResponse.status).toBe(400);
      await expect(missingResponse.json()).resolves.toEqual({
        error: "paymentIntentId is required.",
      });

      const invalidJsonRequest = new Request(
        "https://example.test/api/trainer/onboarding/confirm-background-payment",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{not-json",
        },
      );
      const invalidJsonResponse = await postConfirmBackgroundPayment(invalidJsonRequest);
      expect(invalidJsonResponse.status).toBe(400);
      await expect(invalidJsonResponse.json()).resolves.toEqual({
        error: "paymentIntentId is required.",
      });
    });

    it("trims paymentIntentId and confirms payment", async () => {
      const response = await postConfirmBackgroundPayment(
        jsonPost("https://example.test/api/trainer/onboarding/confirm-background-payment", {
          paymentIntentId: "  pi_abc  ",
        }),
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ ok: true });
      expect(mockConfirmTrainerBackgroundCheckPaymentIntent).toHaveBeenCalledWith({
        trainerId: "trainer_1",
        paymentIntentId: "pi_abc",
      });
    });

    it("returns 503 when confirm fails because Stripe is not configured", async () => {
      mockConfirmTrainerBackgroundCheckPaymentIntent.mockRejectedValueOnce(
        new Error("STRIPE_SECRET_KEY is not configured."),
      );

      const response = await postConfirmBackgroundPayment(
        jsonPost("https://example.test/api/trainer/onboarding/confirm-background-payment", {
          paymentIntentId: "pi_123",
        }),
      );

      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toEqual({
        error: "STRIPE_SECRET_KEY is not configured.",
      });
      expect(mockPublicApiErrorFromUnknown).not.toHaveBeenCalled();
    });

    it("maps unexpected confirm errors through publicApiErrorFromUnknown", async () => {
      const upstreamError = new Error("webhook race");
      mockConfirmTrainerBackgroundCheckPaymentIntent.mockRejectedValueOnce(upstreamError);
      mockPublicApiErrorFromUnknown.mockReturnValueOnce({
        message: "Could not confirm payment.",
        status: 409,
      });

      const response = await postConfirmBackgroundPayment(
        jsonPost("https://example.test/api/trainer/onboarding/confirm-background-payment", {
          paymentIntentId: "pi_123",
        }),
      );

      expect(mockPublicApiErrorFromUnknown).toHaveBeenCalledWith(
        upstreamError,
        "Could not confirm payment.",
        { logLabel: "[trainer confirm background payment]" },
      );
      expect(response.status).toBe(409);
      await expect(response.json()).resolves.toEqual({ error: "Could not confirm payment." });
    });
  });
});
