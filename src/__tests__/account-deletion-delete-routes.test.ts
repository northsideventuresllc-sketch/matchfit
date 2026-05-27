import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockScheduleClientAccountDeletion,
  mockScheduleTrainerAccountDeletion,
  mockResetInternalQaClientAccount,
  mockResetInternalQaTrainerAccount,
  mockClientFindUnique,
  mockTrainerFindUnique,
  mockVerifyPassword,
  mockClearClientSession,
  mockClearTrainerSession,
  mockGetSessionClientId,
  mockGetSessionTrainerId,
  mockIsMatchFitInternalQaClientEmail,
  mockIsMatchFitInternalQaTrainerEmail,
  mockPublicApiErrorFromUnknown,
} = vi.hoisted(() => ({
  mockScheduleClientAccountDeletion: vi.fn(),
  mockScheduleTrainerAccountDeletion: vi.fn(),
  mockResetInternalQaClientAccount: vi.fn(),
  mockResetInternalQaTrainerAccount: vi.fn(),
  mockClientFindUnique: vi.fn(),
  mockTrainerFindUnique: vi.fn(),
  mockVerifyPassword: vi.fn(),
  mockClearClientSession: vi.fn(),
  mockClearTrainerSession: vi.fn(),
  mockGetSessionClientId: vi.fn(),
  mockGetSessionTrainerId: vi.fn(),
  mockIsMatchFitInternalQaClientEmail: vi.fn(),
  mockIsMatchFitInternalQaTrainerEmail: vi.fn(),
  mockPublicApiErrorFromUnknown: vi.fn(),
}));

vi.mock("@/lib/account-deletion-grace", () => ({
  scheduleClientAccountDeletion: mockScheduleClientAccountDeletion,
  scheduleTrainerAccountDeletion: mockScheduleTrainerAccountDeletion,
}));

vi.mock("@/lib/internal-qa-account-reset", () => ({
  resetInternalQaClientAccount: mockResetInternalQaClientAccount,
  resetInternalQaTrainerAccount: mockResetInternalQaTrainerAccount,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    client: {
      findUnique: mockClientFindUnique,
    },
    trainer: {
      findUnique: mockTrainerFindUnique,
    },
  },
}));

vi.mock("@/lib/password", () => ({
  verifyPassword: mockVerifyPassword,
}));

vi.mock("@/lib/session", () => ({
  clearClientSession: mockClearClientSession,
  clearTrainerSession: mockClearTrainerSession,
  getSessionClientId: mockGetSessionClientId,
  getSessionTrainerId: mockGetSessionTrainerId,
}));

vi.mock("@/lib/match-fit-internal-qa", () => ({
  isMatchFitInternalQaClientEmail: mockIsMatchFitInternalQaClientEmail,
  isMatchFitInternalQaTrainerEmail: mockIsMatchFitInternalQaTrainerEmail,
}));

vi.mock("@/lib/public-api-error", () => ({
  publicApiErrorFromUnknown: mockPublicApiErrorFromUnknown,
}));

import { POST as postClientDelete } from "@/app/api/client/settings/account/delete/route";
import { POST as postTrainerDelete } from "@/app/api/trainer/settings/account/delete/route";

function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("account delete API routes", () => {
  const finalizeAt = new Date("2026-06-20T00:00:00.000Z");

  beforeEach(() => {
    vi.clearAllMocks();

    mockGetSessionClientId.mockResolvedValue("client_1");
    mockGetSessionTrainerId.mockResolvedValue("trainer_1");

    mockClientFindUnique.mockResolvedValue({
      passwordHash: "hash",
      deidentifiedAt: null,
      accountDeletionFinalizeAt: null,
      email: "client@example.com",
    });
    mockTrainerFindUnique.mockResolvedValue({
      passwordHash: "hash",
      deidentifiedAt: null,
      accountDeletionFinalizeAt: null,
      email: "trainer@example.com",
    });

    mockVerifyPassword.mockResolvedValue(true);
    mockIsMatchFitInternalQaClientEmail.mockReturnValue(false);
    mockIsMatchFitInternalQaTrainerEmail.mockReturnValue(false);
    mockScheduleClientAccountDeletion.mockResolvedValue(finalizeAt);
    mockScheduleTrainerAccountDeletion.mockResolvedValue(finalizeAt);
    mockPublicApiErrorFromUnknown.mockReturnValue({
      message: "Could not delete account.",
      status: 500,
    });
  });

  it("returns 401 for client requests without an authenticated session", async () => {
    mockGetSessionClientId.mockResolvedValueOnce(null);

    const response = await postClientDelete(
      jsonRequest("https://example.test/api/client/settings/account/delete", { password: "pw" }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized." });
    expect(mockClientFindUnique).not.toHaveBeenCalled();
  });

  it("returns 400 for trainer requests with an invalid body", async () => {
    const response = await postTrainerDelete(
      jsonRequest("https://example.test/api/trainer/settings/account/delete", { password: "" }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Password is required." });
    expect(mockTrainerFindUnique).not.toHaveBeenCalled();
  });

  it("returns 401 when client row is deidentified", async () => {
    mockClientFindUnique.mockResolvedValueOnce({
      passwordHash: "hash",
      deidentifiedAt: new Date("2026-05-01T00:00:00.000Z"),
      accountDeletionFinalizeAt: null,
      email: "client@example.com",
    });

    const response = await postClientDelete(
      jsonRequest("https://example.test/api/client/settings/account/delete", { password: "pw" }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized." });
    expect(mockVerifyPassword).not.toHaveBeenCalled();
  });

  it("returns 409 when trainer deletion is already scheduled", async () => {
    mockTrainerFindUnique.mockResolvedValueOnce({
      passwordHash: "hash",
      deidentifiedAt: null,
      accountDeletionFinalizeAt: new Date(Date.now() + 60_000),
      email: "trainer@example.com",
    });

    const response = await postTrainerDelete(
      jsonRequest("https://example.test/api/trainer/settings/account/delete", { password: "pw" }),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "Account deletion is already scheduled.",
    });
    expect(mockVerifyPassword).not.toHaveBeenCalled();
  });

  it("returns 401 when the client password is incorrect", async () => {
    mockVerifyPassword.mockResolvedValueOnce(false);

    const response = await postClientDelete(
      jsonRequest("https://example.test/api/client/settings/account/delete", { password: "bad-password" }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Incorrect password." });
    expect(mockScheduleClientAccountDeletion).not.toHaveBeenCalled();
    expect(mockClearClientSession).not.toHaveBeenCalled();
  });

  it("resets internal QA client accounts immediately", async () => {
    mockIsMatchFitInternalQaClientEmail.mockReturnValueOnce(true);

    const response = await postClientDelete(
      jsonRequest("https://example.test/api/client/settings/account/delete", { password: "pw" }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, immediate: true });
    expect(mockResetInternalQaClientAccount).toHaveBeenCalledWith("client_1");
    expect(mockClearClientSession).toHaveBeenCalledTimes(1);
    expect(mockScheduleClientAccountDeletion).not.toHaveBeenCalled();
  });

  it("schedules trainer account deletion and clears session", async () => {
    const response = await postTrainerDelete(
      jsonRequest("https://example.test/api/trainer/settings/account/delete", { password: "pw" }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      scheduled: true,
      finalizeAt: finalizeAt.toISOString(),
    });
    expect(mockScheduleTrainerAccountDeletion).toHaveBeenCalledWith("trainer_1");
    expect(mockClearTrainerSession).toHaveBeenCalledTimes(1);
    expect(mockResetInternalQaTrainerAccount).not.toHaveBeenCalled();
  });

  it("maps unexpected trainer delete errors via publicApiErrorFromUnknown", async () => {
    const failure = new Error("db unavailable");
    mockTrainerFindUnique.mockRejectedValueOnce(failure);
    mockPublicApiErrorFromUnknown.mockReturnValueOnce({
      message: "Could not delete account.",
      status: 503,
    });

    const response = await postTrainerDelete(
      jsonRequest("https://example.test/api/trainer/settings/account/delete", { password: "pw" }),
    );

    expect(mockPublicApiErrorFromUnknown).toHaveBeenCalledWith(
      failure,
      "Could not delete account.",
      { logLabel: "[trainer account delete]" },
    );
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "Could not delete account." });
  });
});
