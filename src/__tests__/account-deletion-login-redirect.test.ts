import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockFinalizeScheduledDeletionIfOverdue,
  mockIsAccountDeletionGraceActive,
  mockAccountDeletionScheduledLoginNext,
  mockClientFindUnique,
  mockTrainerFindUnique,
} = vi.hoisted(() => ({
  mockFinalizeScheduledDeletionIfOverdue: vi.fn(),
  mockIsAccountDeletionGraceActive: vi.fn(),
  mockAccountDeletionScheduledLoginNext: vi.fn(),
  mockClientFindUnique: vi.fn(),
  mockTrainerFindUnique: vi.fn(),
}));

vi.mock("@/lib/account-deletion-grace", () => ({
  finalizeScheduledDeletionIfOverdue: mockFinalizeScheduledDeletionIfOverdue,
  isAccountDeletionGraceActive: mockIsAccountDeletionGraceActive,
  accountDeletionScheduledLoginNext: mockAccountDeletionScheduledLoginNext,
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

import {
  clientLoginDeletionRedirect,
  trainerLoginDeletionRedirect,
} from "@/lib/account-deletion-login-redirect";

describe("account-deletion-login-redirect", () => {
  beforeEach(() => {
    mockFinalizeScheduledDeletionIfOverdue.mockReset();
    mockIsAccountDeletionGraceActive.mockReset();
    mockAccountDeletionScheduledLoginNext.mockReset();
    mockClientFindUnique.mockReset();
    mockTrainerFindUnique.mockReset();

    mockFinalizeScheduledDeletionIfOverdue.mockResolvedValue(false);
    mockIsAccountDeletionGraceActive.mockReturnValue(false);
    mockAccountDeletionScheduledLoginNext.mockImplementation((role: "client" | "trainer") =>
      role === "client" ? "/client/account-deletion-scheduled" : "/trainer/account-deletion-scheduled",
    );
  });

  it("returns null when client is finalized during login", async () => {
    mockFinalizeScheduledDeletionIfOverdue.mockResolvedValueOnce(true);

    await expect(clientLoginDeletionRedirect("client_123")).resolves.toBeNull();

    expect(mockFinalizeScheduledDeletionIfOverdue).toHaveBeenCalledWith({
      role: "client",
      id: "client_123",
    });
    expect(mockClientFindUnique).not.toHaveBeenCalled();
  });

  it("returns null for missing or deidentified client rows", async () => {
    mockClientFindUnique.mockResolvedValueOnce(null);
    await expect(clientLoginDeletionRedirect("client_missing")).resolves.toBeNull();

    const finalizeAt = new Date(Date.now() + 60_000);
    mockClientFindUnique.mockResolvedValueOnce({
      accountDeletionRequestedAt: new Date(Date.now() - 1_000),
      accountDeletionFinalizeAt: finalizeAt,
      deidentifiedAt: new Date(),
    });
    mockIsAccountDeletionGraceActive.mockReturnValueOnce(true);

    await expect(clientLoginDeletionRedirect("client_deleted")).resolves.toBeNull();
    expect(mockClientFindUnique).toHaveBeenCalledWith({
      where: { id: "client_deleted" },
      select: {
        accountDeletionRequestedAt: true,
        accountDeletionFinalizeAt: true,
        deidentifiedAt: true,
      },
    });
  });

  it("returns client redirect payload when grace window is active", async () => {
    const finalizeAt = new Date(Date.now() + 120_000);
    const row = {
      accountDeletionRequestedAt: new Date(Date.now() - 2_000),
      accountDeletionFinalizeAt: finalizeAt,
      deidentifiedAt: null,
    };
    mockClientFindUnique.mockResolvedValueOnce(row);
    mockIsAccountDeletionGraceActive.mockReturnValueOnce(true);

    await expect(clientLoginDeletionRedirect("client_live")).resolves.toEqual({
      next: "/client/account-deletion-scheduled",
      finalizeAt: finalizeAt.toISOString(),
    });
    expect(mockIsAccountDeletionGraceActive).toHaveBeenCalledWith(row);
    expect(mockAccountDeletionScheduledLoginNext).toHaveBeenCalledWith("client");
  });

  it("returns null when trainer grace window is inactive", async () => {
    const finalizeAt = new Date(Date.now() + 120_000);
    mockTrainerFindUnique.mockResolvedValueOnce({
      accountDeletionRequestedAt: new Date(Date.now() - 2_000),
      accountDeletionFinalizeAt: finalizeAt,
      deidentifiedAt: null,
    });
    mockIsAccountDeletionGraceActive.mockReturnValueOnce(false);

    await expect(trainerLoginDeletionRedirect("trainer_123")).resolves.toBeNull();
    expect(mockTrainerFindUnique).toHaveBeenCalledWith({
      where: { id: "trainer_123" },
      select: {
        accountDeletionRequestedAt: true,
        accountDeletionFinalizeAt: true,
        deidentifiedAt: true,
      },
    });
  });

  it("returns trainer redirect payload when grace window is active", async () => {
    const finalizeAt = new Date(Date.now() + 120_000);
    const row = {
      accountDeletionRequestedAt: new Date(Date.now() - 2_000),
      accountDeletionFinalizeAt: finalizeAt,
      deidentifiedAt: null,
    };
    mockTrainerFindUnique.mockResolvedValueOnce(row);
    mockIsAccountDeletionGraceActive.mockReturnValueOnce(true);

    await expect(trainerLoginDeletionRedirect("trainer_live")).resolves.toEqual({
      next: "/trainer/account-deletion-scheduled",
      finalizeAt: finalizeAt.toISOString(),
    });
    expect(mockFinalizeScheduledDeletionIfOverdue).toHaveBeenCalledWith({
      role: "trainer",
      id: "trainer_live",
    });
    expect(mockIsAccountDeletionGraceActive).toHaveBeenCalledWith(row);
    expect(mockAccountDeletionScheduledLoginNext).toHaveBeenCalledWith("trainer");
  });
});
