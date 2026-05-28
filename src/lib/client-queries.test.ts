import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  clientFindFirstMock,
  pendingClientRegistrationFindFirstMock,
  betaClientWaitlistEntryFindFirstMock,
} = vi.hoisted(() => ({
  clientFindFirstMock: vi.fn(),
  pendingClientRegistrationFindFirstMock: vi.fn(),
  betaClientWaitlistEntryFindFirstMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    client: { findFirst: clientFindFirstMock },
    pendingClientRegistration: { findFirst: pendingClientRegistrationFindFirstMock },
    betaClientWaitlistEntry: { findFirst: betaClientWaitlistEntryFindFirstMock },
  },
}));

import {
  findClientByIdentifier,
  isEmailTaken,
  isEmailTakenByAnother,
  isPhoneTakenByAnother,
  isUsernameTaken,
  isUsernameTakenByAnother,
} from "@/lib/client-queries";

describe("client-queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clientFindFirstMock.mockResolvedValue(null);
    pendingClientRegistrationFindFirstMock.mockResolvedValue(null);
    betaClientWaitlistEntryFindFirstMock.mockResolvedValue(null);
  });

  it("returns null and skips prisma when identifier is empty", async () => {
    await expect(findClientByIdentifier("   ")).resolves.toBeNull();
    expect(clientFindFirstMock).not.toHaveBeenCalled();
  });

  it("normalizes identifier and queries non-deidentified clients", async () => {
    const foundClient = { id: "client_123" };
    clientFindFirstMock.mockResolvedValueOnce(foundClient);

    await expect(findClientByIdentifier("User@Example.com")).resolves.toEqual(foundClient);

    expect(clientFindFirstMock).toHaveBeenCalledWith({
      where: {
        deidentifiedAt: null,
        OR: [{ email: "user@example.com" }],
      },
    });
  });

  it("returns true for taken usernames from existing active clients", async () => {
    clientFindFirstMock.mockResolvedValueOnce({ id: "client_123" });

    await expect(isUsernameTaken("  my_handle  ")).resolves.toBe(true);
    expect(clientFindFirstMock).toHaveBeenCalledWith({
      where: { username: "my_handle", deidentifiedAt: null },
    });
    expect(pendingClientRegistrationFindFirstMock).not.toHaveBeenCalled();
    expect(betaClientWaitlistEntryFindFirstMock).not.toHaveBeenCalled();
  });

  it("checks pending holds and invited waitlist reservations for username availability", async () => {
    clientFindFirstMock.mockResolvedValueOnce(null);
    pendingClientRegistrationFindFirstMock.mockResolvedValueOnce({ id: "pending_1" });

    await expect(isUsernameTaken("handle")).resolves.toBe(true);
    expect(pendingClientRegistrationFindFirstMock).toHaveBeenCalledWith({
      where: {
        username: "handle",
        expiresAt: { gt: expect.any(Date) },
        status: { in: ["PENDING_2FA", "AWAITING_PAYMENT"] },
      },
    });
    expect(betaClientWaitlistEntryFindFirstMock).not.toHaveBeenCalled();

    clientFindFirstMock.mockResolvedValueOnce(null);
    pendingClientRegistrationFindFirstMock.mockResolvedValueOnce(null);
    betaClientWaitlistEntryFindFirstMock.mockResolvedValueOnce({ id: "wait_1" });
    await expect(isUsernameTaken("handle")).resolves.toBe(true);
    expect(betaClientWaitlistEntryFindFirstMock).toHaveBeenLastCalledWith({
      where: {
        desiredUsername: "handle",
        status: "INVITED",
        slotExpiresAt: { gt: expect.any(Date) },
      },
      select: { id: true },
    });
  });

  it("returns false when username has no active holders", async () => {
    await expect(isUsernameTaken("available-name")).resolves.toBe(false);
  });

  it("lowercases and trims email before checking active holds", async () => {
    await expect(isEmailTaken("  USER@Example.COM ")).resolves.toBe(false);

    expect(clientFindFirstMock).toHaveBeenCalledWith({
      where: { email: "user@example.com", deidentifiedAt: null },
    });
    expect(pendingClientRegistrationFindFirstMock).toHaveBeenCalledWith({
      where: {
        email: "user@example.com",
        expiresAt: { gt: expect.any(Date) },
        status: { in: ["PENDING_2FA", "AWAITING_PAYMENT"] },
      },
    });
    expect(betaClientWaitlistEntryFindFirstMock).toHaveBeenCalledWith({
      where: {
        email: "user@example.com",
        status: "INVITED",
        slotExpiresAt: { gt: expect.any(Date) },
      },
      select: { id: true },
    });
  });

  it("checks other accounts, pendingEmail holders, and active waits for duplicate emails", async () => {
    clientFindFirstMock.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "client_held" });

    await expect(isEmailTakenByAnother("new@example.com", "client_self")).resolves.toBe(true);
    expect(clientFindFirstMock).toHaveBeenNthCalledWith(1, {
      where: { email: "new@example.com", deidentifiedAt: null, NOT: { id: "client_self" } },
    });
    expect(clientFindFirstMock).toHaveBeenNthCalledWith(2, {
      where: { pendingEmail: "new@example.com", deidentifiedAt: null, NOT: { id: "client_self" } },
    });
    expect(pendingClientRegistrationFindFirstMock).not.toHaveBeenCalled();

    clientFindFirstMock.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    pendingClientRegistrationFindFirstMock.mockResolvedValueOnce({ id: "pending_held" });
    await expect(isEmailTakenByAnother("new@example.com", "client_self")).resolves.toBe(true);
  });

  it("checks active pending registrations for duplicate phone numbers", async () => {
    clientFindFirstMock.mockResolvedValueOnce(null);
    pendingClientRegistrationFindFirstMock.mockResolvedValueOnce({ id: "pending_phone" });

    await expect(isPhoneTakenByAnother("  +14045550100  ", "client_self")).resolves.toBe(true);

    expect(clientFindFirstMock).toHaveBeenCalledWith({
      where: { phone: "+14045550100", deidentifiedAt: null, NOT: { id: "client_self" } },
    });
    expect(pendingClientRegistrationFindFirstMock).toHaveBeenCalledWith({
      where: {
        phone: "+14045550100",
        expiresAt: { gt: expect.any(Date) },
        status: { in: ["PENDING_2FA", "AWAITING_PAYMENT"] },
      },
    });
  });

  it("checks other clients, pending holds, and invited waits for duplicate usernames", async () => {
    clientFindFirstMock.mockResolvedValueOnce(null);
    pendingClientRegistrationFindFirstMock.mockResolvedValueOnce(null);
    betaClientWaitlistEntryFindFirstMock.mockResolvedValueOnce({ id: "wait_username" });

    await expect(isUsernameTakenByAnother("  coachy ", "client_self")).resolves.toBe(true);

    expect(clientFindFirstMock).toHaveBeenCalledWith({
      where: { username: "coachy", deidentifiedAt: null, NOT: { id: "client_self" } },
    });
    expect(pendingClientRegistrationFindFirstMock).toHaveBeenCalledWith({
      where: {
        username: "coachy",
        expiresAt: { gt: expect.any(Date) },
        status: { in: ["PENDING_2FA", "AWAITING_PAYMENT"] },
      },
    });
    expect(betaClientWaitlistEntryFindFirstMock).toHaveBeenCalledWith({
      where: {
        desiredUsername: "coachy",
        status: "INVITED",
        slotExpiresAt: { gt: expect.any(Date) },
      },
      select: { id: true },
    });
  });
});
