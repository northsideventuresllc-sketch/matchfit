import { beforeEach, describe, expect, it, vi } from "vitest";

const { trainerFindFirstMock, betaTrainerWaitlistEntryFindFirstMock } = vi.hoisted(() => ({
  trainerFindFirstMock: vi.fn(),
  betaTrainerWaitlistEntryFindFirstMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainer: { findFirst: trainerFindFirstMock },
    betaTrainerWaitlistEntry: { findFirst: betaTrainerWaitlistEntryFindFirstMock },
  },
}));

import {
  findTrainerByIdentifier,
  isTrainerEmailTaken,
  isTrainerUsernameTaken,
  isTrainerUsernameTakenByAnother,
} from "@/lib/trainer-queries";

describe("trainer-queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    trainerFindFirstMock.mockResolvedValue(null);
    betaTrainerWaitlistEntryFindFirstMock.mockResolvedValue(null);
  });

  it("returns null and skips prisma when identifier is empty", async () => {
    await expect(findTrainerByIdentifier("   ")).resolves.toBeNull();
    expect(trainerFindFirstMock).not.toHaveBeenCalled();
  });

  it("normalizes email identifier and queries active trainers", async () => {
    const foundTrainer = { id: "trainer_123" };
    trainerFindFirstMock.mockResolvedValueOnce(foundTrainer);

    await expect(findTrainerByIdentifier("TrainER@Example.com")).resolves.toEqual(foundTrainer);

    expect(trainerFindFirstMock).toHaveBeenCalledWith({
      where: {
        deidentifiedAt: null,
        OR: [{ email: "trainer@example.com" }],
      },
    });
  });

  it("returns true for trainer usernames reserved by invited waitlist entries", async () => {
    trainerFindFirstMock.mockResolvedValueOnce(null);
    betaTrainerWaitlistEntryFindFirstMock.mockResolvedValueOnce({ id: "wait_1" });

    await expect(isTrainerUsernameTaken("  trainer_handle  ")).resolves.toBe(true);

    expect(trainerFindFirstMock).toHaveBeenCalledWith({
      where: { username: "trainer_handle", deidentifiedAt: null },
    });
    expect(betaTrainerWaitlistEntryFindFirstMock).toHaveBeenCalledWith({
      where: {
        desiredUsername: "trainer_handle",
        status: "INVITED",
        slotExpiresAt: { gt: expect.any(Date) },
      },
      select: { id: true },
    });
  });

  it("checks lowercase email against both trainers and invited waitlist", async () => {
    await expect(isTrainerEmailTaken("  TRAINER@Example.COM ")).resolves.toBe(false);

    expect(trainerFindFirstMock).toHaveBeenCalledWith({
      where: { email: "trainer@example.com", deidentifiedAt: null },
    });
    expect(betaTrainerWaitlistEntryFindFirstMock).toHaveBeenCalledWith({
      where: {
        email: "trainer@example.com",
        status: "INVITED",
        slotExpiresAt: { gt: expect.any(Date) },
      },
      select: { id: true },
    });
  });

  it("checks other trainer account before invited username reservations", async () => {
    trainerFindFirstMock.mockResolvedValueOnce({ id: "other_trainer" });

    await expect(isTrainerUsernameTakenByAnother("name", "trainer_self")).resolves.toBe(true);
    expect(betaTrainerWaitlistEntryFindFirstMock).not.toHaveBeenCalled();

    trainerFindFirstMock.mockResolvedValueOnce(null);
    betaTrainerWaitlistEntryFindFirstMock.mockResolvedValueOnce({ id: "reserved_wait" });
    await expect(isTrainerUsernameTakenByAnother("name", "trainer_self")).resolves.toBe(true);
    expect(betaTrainerWaitlistEntryFindFirstMock).toHaveBeenLastCalledWith({
      where: {
        desiredUsername: "name",
        status: "INVITED",
        slotExpiresAt: { gt: expect.any(Date) },
      },
      select: { id: true },
    });
  });
});
