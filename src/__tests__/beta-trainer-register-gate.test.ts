import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/beta-launch-config", () => ({
  isBetaLaunchGatesEnabled: vi.fn(() => true),
}));

vi.mock("@/lib/beta-waitlist-service", () => ({
  isTrainerBetaCapReached: vi.fn(),
  getValidBetaInvite: vi.fn(),
}));

import { isBetaLaunchGatesEnabled } from "@/lib/beta-launch-config";
import { evaluateBetaTrainerRegistrationGate } from "@/lib/beta-trainer-register-gate";
import { getValidBetaInvite, isTrainerBetaCapReached } from "@/lib/beta-waitlist-service";

describe("evaluateBetaTrainerRegistrationGate", () => {
  beforeEach(() => {
    vi.mocked(isBetaLaunchGatesEnabled).mockReturnValue(true);
    vi.mocked(isTrainerBetaCapReached).mockResolvedValue(false);
  });

  it("worldwide (2026-07-31): allows empty location even when beta gates are off — no longer a hard US-zip requirement", async () => {
    vi.mocked(isBetaLaunchGatesEnabled).mockReturnValue(false);
    const result = await evaluateBetaTrainerRegistrationGate({
      serviceZipCode: "",
      email: "coach@example.com",
      username: "coachbay",
    });
    expect(result).toEqual({ ok: true, betaInviteEntryId: null });
  });

  it("allows nationwide US ZIP codes when beta gates are on", async () => {
    const result = await evaluateBetaTrainerRegistrationGate({
      serviceZipCode: "94102",
      email: "coach@example.com",
      username: "coachbay",
    });
    expect(result).toEqual({ ok: true, betaInviteEntryId: null });
  });

  it("worldwide (2026-07-31): a non-US location string no longer blocks registration (virtual-only trainer)", async () => {
    const result = await evaluateBetaTrainerRegistrationGate({
      serviceZipCode: "London, UK",
      email: "coach@example.com",
      username: "coachbay",
    });
    expect(result).toEqual({ ok: true, betaInviteEntryId: null });
  });

  it("requires beta invite when cap is full", async () => {
    vi.mocked(isTrainerBetaCapReached).mockResolvedValue(true);
    vi.mocked(getValidBetaInvite).mockResolvedValue(null);
    const result = await evaluateBetaTrainerRegistrationGate({
      serviceZipCode: "10001",
      email: "coach@example.com",
      username: "coachbay",
    });
    expect(result).toMatchObject({ ok: false, code: "BETA_TRAINER_CAP", status: 403 });
  });
});
