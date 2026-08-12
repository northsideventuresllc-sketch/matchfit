import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  findManyMock,
  updateMock,
  trainerFindFirstMock,
  clientFindFirstMock,
  sendTransactionalEmailIfAllowedMock,
  ownerTestExcludedSignupProgressWhereMock,
} = vi.hoisted(() => ({
  findManyMock: vi.fn(),
  updateMock: vi.fn(),
  trainerFindFirstMock: vi.fn(),
  clientFindFirstMock: vi.fn(),
  sendTransactionalEmailIfAllowedMock: vi.fn(),
  ownerTestExcludedSignupProgressWhereMock: vi.fn(() => ({})),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    signupFormProgress: {
      findMany: findManyMock,
      update: updateMock,
    },
    trainer: {
      findFirst: trainerFindFirstMock,
    },
    client: {
      findFirst: clientFindFirstMock,
    },
  },
}));

vi.mock("@/lib/transactional-email-send", () => ({
  sendTransactionalEmailIfAllowed: sendTransactionalEmailIfAllowedMock,
}));

vi.mock("@/lib/owner-test-account-exclusion", () => ({
  ownerTestExcludedSignupProgressWhere: ownerTestExcludedSignupProgressWhereMock,
}));

import { runSignupAbandonmentFollowupJobs } from "@/lib/signup-abandonment-followup-cron";

function row(overrides: Partial<{
  id: string;
  role: string;
  email: string | null;
  followupEmailsSent: number;
  updatedAt: Date;
}> = {}) {
  return {
    id: "row_1",
    role: "trainer",
    email: "coach@example.com",
    followupEmailsSent: 0,
    updatedAt: new Date("2026-08-07T00:00:00.000Z"),
    ...overrides,
  };
}

describe("runSignupAbandonmentFollowupJobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findManyMock.mockResolvedValue([]);
    trainerFindFirstMock.mockResolvedValue(null);
    clientFindFirstMock.mockResolvedValue(null);
    sendTransactionalEmailIfAllowedMock.mockResolvedValue({ sent: true });
    ownerTestExcludedSignupProgressWhereMock.mockReturnValue({});
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-07T12:00:00.000Z"));
  });

  it("sends the first follow-up once a trainer row has been idle for 1 hour and advances the counter", async () => {
    findManyMock.mockImplementation(({ where }: { where: { role: string } }) =>
      Promise.resolve(
        where.role === "trainer"
          ? [row({ updatedAt: new Date("2026-08-07T10:00:00.000Z") })] // 2h idle
          : [],
      ),
    );

    const summary = await runSignupAbandonmentFollowupJobs();

    expect(sendTransactionalEmailIfAllowedMock).toHaveBeenCalledTimes(1);
    expect(sendTransactionalEmailIfAllowedMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "TRAINER_SIGNUP_FOLLOWUP_1",
        to: "coach@example.com",
        audience: "TRAINER",
        variables: expect.objectContaining({ signupResumeUrl: expect.stringContaining("/trainer/signup") }),
      }),
    );
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: "row_1" },
      data: { followupEmailsSent: 1, lastFollowupSentAt: new Date("2026-08-07T12:00:00.000Z") },
    });
    expect(summary.sent).toBe(1);
  });

  it("does not send when the row has not been idle long enough yet", async () => {
    findManyMock.mockImplementation(({ where }: { where: { role: string } }) =>
      Promise.resolve(
        where.role === "trainer" ? [row({ updatedAt: new Date("2026-08-07T11:30:00.000Z") })] : [],
      ),
    );

    const summary = await runSignupAbandonmentFollowupJobs();

    expect(sendTransactionalEmailIfAllowedMock).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
    expect(summary.sent).toBe(0);
  });

  it("sends the client role's follow-up 2 kind with the client resume link after 24 hours", async () => {
    findManyMock.mockImplementation(({ where }: { where: { role: string } }) =>
      Promise.resolve(
        where.role === "client"
          ? [
              row({
                id: "row_client",
                role: "client",
                email: "member@example.com",
                followupEmailsSent: 1,
                updatedAt: new Date("2026-08-06T12:00:00.000Z"), // exactly 24h idle
              }),
            ]
          : [],
      ),
    );

    await runSignupAbandonmentFollowupJobs();

    expect(sendTransactionalEmailIfAllowedMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "CLIENT_SIGNUP_FOLLOWUP_2",
        to: "member@example.com",
        audience: "CLIENT",
        variables: expect.objectContaining({ signupResumeUrl: expect.stringContaining("/client/sign-up") }),
      }),
    );
  });

  it("skips a row and marks the sequence exhausted when the visitor already has a real account", async () => {
    findManyMock.mockImplementation(({ where }: { where: { role: string } }) =>
      Promise.resolve(
        where.role === "trainer"
          ? [row({ updatedAt: new Date("2026-08-07T00:00:00.000Z") })]
          : [],
      ),
    );
    trainerFindFirstMock.mockResolvedValue({ id: "trainer_already_exists" });

    const summary = await runSignupAbandonmentFollowupJobs();

    expect(sendTransactionalEmailIfAllowedMock).not.toHaveBeenCalled();
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: "row_1" },
      data: { followupEmailsSent: 3, lastFollowupSentAt: new Date("2026-08-07T12:00:00.000Z") },
    });
    expect(summary.skippedAlreadyHasAccount).toBe(1);
  });

  it("does not query for a row with followupEmailsSent already at the cap (DB filter, sanity-checked here)", async () => {
    // The Prisma where clause already excludes followupEmailsSent >= 3; this test documents
    // that even if one slipped through, isDueForNextSignupFollowup would refuse to send.
    findManyMock.mockImplementation(({ where }: { where: { role: string } }) =>
      Promise.resolve(
        where.role === "trainer"
          ? [row({ followupEmailsSent: 3, updatedAt: new Date("2020-01-01T00:00:00.000Z") })]
          : [],
      ),
    );

    const summary = await runSignupAbandonmentFollowupJobs();

    expect(sendTransactionalEmailIfAllowedMock).not.toHaveBeenCalled();
    expect(summary.sent).toBe(0);
  });

  it("continues processing remaining rows and counts an error when one send throws", async () => {
    findManyMock.mockImplementation(({ where }: { where: { role: string } }) =>
      Promise.resolve(
        where.role === "trainer"
          ? [
              row({ id: "row_a", email: "a@example.com", updatedAt: new Date("2026-08-07T00:00:00.000Z") }),
              row({ id: "row_b", email: "b@example.com", updatedAt: new Date("2026-08-07T00:00:00.000Z") }),
            ]
          : [],
      ),
    );
    sendTransactionalEmailIfAllowedMock
      .mockRejectedValueOnce(new Error("resend down"))
      .mockResolvedValueOnce({ sent: true });

    const summary = await runSignupAbandonmentFollowupJobs();

    expect(sendTransactionalEmailIfAllowedMock).toHaveBeenCalledTimes(2);
    expect(summary.errors).toBe(1);
    expect(summary.sent).toBe(1);
  });
});
