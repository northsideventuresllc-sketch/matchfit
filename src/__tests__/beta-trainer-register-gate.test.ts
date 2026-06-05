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

  it("requires valid US ZIP even when beta gates are off", async () => {
    vi.mocked(isBetaLaunchGatesEnabled).mockReturnValue(false);
    const result = await evaluateBetaTrainerRegistrationGate({
      serviceZipCode: "",
      email: "coach@example.com",
      username: "coachbay",
    });
    expect(result).toMatchObject({ ok: false, code: "INVALID_SERVICE_ZIP", status: 400 });
  });

  it("allows nationwide US ZIP codes when beta gates are on", async () => {
    const result = await evaluateBetaTrainerRegistrationGate({
      serviceZipCode: "94102",
      email: "coach@example.com",
      username: "coachbay",
    });
    expect(result).toEqual({ ok: true, betaInviteEntryId: null });
  });

  it("rejects invalid ZIP format", async () => {
    const result = await evaluateBetaTrainerRegistrationGate({
      serviceZipCode: "abc",
      email: "coach@example.com",
      username: "coachbay",
    });
    expect(result).toMatchObject({ ok: false, code: "INVALID_SERVICE_ZIP", status: 400 });
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
