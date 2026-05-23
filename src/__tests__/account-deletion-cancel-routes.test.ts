import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockCancelScheduledClientAccountDeletion,
  mockCancelScheduledTrainerAccountDeletion,
  mockGetSessionClientId,
  mockGetSessionTrainerId,
  mockPublicApiErrorFromUnknown,
} = vi.hoisted(() => ({
  mockCancelScheduledClientAccountDeletion: vi.fn(),
  mockCancelScheduledTrainerAccountDeletion: vi.fn(),
  mockGetSessionClientId: vi.fn(),
  mockGetSessionTrainerId: vi.fn(),
  mockPublicApiErrorFromUnknown: vi.fn(),
}));

vi.mock("@/lib/account-deletion-grace", () => ({
  cancelScheduledClientAccountDeletion: mockCancelScheduledClientAccountDeletion,
  cancelScheduledTrainerAccountDeletion: mockCancelScheduledTrainerAccountDeletion,
}));

vi.mock("@/lib/session", () => ({
  getSessionClientId: mockGetSessionClientId,
  getSessionTrainerId: mockGetSessionTrainerId,
}));

vi.mock("@/lib/public-api-error", () => ({
  publicApiErrorFromUnknown: mockPublicApiErrorFromUnknown,
}));

import { POST as postClientCancelDeletion } from "@/app/api/client/settings/account/cancel-deletion/route";
import { POST as postTrainerCancelDeletion } from "@/app/api/trainer/settings/account/cancel-deletion/route";

describe("cancel-deletion API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSessionClientId.mockResolvedValue("client_1");
    mockGetSessionTrainerId.mockResolvedValue("trainer_1");
    mockCancelScheduledClientAccountDeletion.mockResolvedValue(true);
    mockCancelScheduledTrainerAccountDeletion.mockResolvedValue(true);
    mockPublicApiErrorFromUnknown.mockReturnValue({
      message: "Could not cancel scheduled deletion.",
      status: 500,
    });
  });

  it("returns 401 for client requests without an authenticated session", async () => {
    mockGetSessionClientId.mockResolvedValueOnce(null);

    const res = await postClientCancelDeletion();
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "Unauthorized." });
    expect(mockCancelScheduledClientAccountDeletion).not.toHaveBeenCalled();
  });

  it("returns 400 for client requests when grace cancellation is unavailable", async () => {
    mockCancelScheduledClientAccountDeletion.mockResolvedValueOnce(false);

    const res = await postClientCancelDeletion();
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: "No scheduled deletion to cancel, or the grace period has ended.",
    });
  });

  it("returns ok=true for successful client cancellation", async () => {
    const res = await postClientCancelDeletion();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(mockCancelScheduledClientAccountDeletion).toHaveBeenCalledWith("client_1");
  });

  it("maps unexpected client errors via publicApiErrorFromUnknown", async () => {
    const failure = new Error("db down");
    mockCancelScheduledClientAccountDeletion.mockRejectedValueOnce(failure);
    mockPublicApiErrorFromUnknown.mockReturnValueOnce({
      message: "Could not cancel scheduled deletion.",
      status: 503,
    });

    const res = await postClientCancelDeletion();
    expect(mockPublicApiErrorFromUnknown).toHaveBeenCalledWith(
      failure,
      "Could not cancel scheduled deletion.",
      {
        logLabel: "[client cancel scheduled deletion]",
      },
    );
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({
      error: "Could not cancel scheduled deletion.",
    });
  });

  it("returns 401 for trainer requests without an authenticated session", async () => {
    mockGetSessionTrainerId.mockResolvedValueOnce(null);

    const res = await postTrainerCancelDeletion();
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "Unauthorized." });
    expect(mockCancelScheduledTrainerAccountDeletion).not.toHaveBeenCalled();
  });

  it("returns 400 for trainer requests when grace cancellation is unavailable", async () => {
    mockCancelScheduledTrainerAccountDeletion.mockResolvedValueOnce(false);

    const res = await postTrainerCancelDeletion();
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: "No scheduled deletion to cancel, or the grace period has ended.",
    });
  });

  it("returns ok=true for successful trainer cancellation", async () => {
    const res = await postTrainerCancelDeletion();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(mockCancelScheduledTrainerAccountDeletion).toHaveBeenCalledWith("trainer_1");
  });

  it("maps unexpected trainer errors via publicApiErrorFromUnknown", async () => {
    const failure = new Error("transaction failed");
    mockCancelScheduledTrainerAccountDeletion.mockRejectedValueOnce(failure);
    mockPublicApiErrorFromUnknown.mockReturnValueOnce({
      message: "Could not cancel scheduled deletion.",
      status: 500,
    });

    const res = await postTrainerCancelDeletion();
    expect(mockPublicApiErrorFromUnknown).toHaveBeenCalledWith(
      failure,
      "Could not cancel scheduled deletion.",
      {
        logLabel: "[trainer cancel scheduled deletion]",
      },
    );
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({
      error: "Could not cancel scheduled deletion.",
    });
  });
});
