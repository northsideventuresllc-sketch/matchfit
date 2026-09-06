import { beforeEach, describe, expect, it, vi } from "vitest";

const { draftFindManyMock, draftUpdateMock, trainerFindUniqueMock, sendResumeEmailMock } = vi.hoisted(() => ({
  draftFindManyMock: vi.fn(),
  draftUpdateMock: vi.fn(),
  trainerFindUniqueMock: vi.fn(),
  sendResumeEmailMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainerDraft: {
      findMany: draftFindManyMock,
      update: draftUpdateMock,
    },
    trainer: {
      findUnique: trainerFindUniqueMock,
    },
  },
}));

vi.mock("@/lib/trainer-resume-signup-email", () => ({
  sendTrainerResumeSignupEmail: sendResumeEmailMock,
}));

import { processTrainerResumeSignupNudges } from "@/lib/trainer-resume-signup-nudge-cron";

function draft(overrides: Partial<{
  id: string;
  email: string | null;
  data: unknown;
}> = {}) {
  return {
    id: "draft_1",
    email: "coach@example.com",
    data: { firstName: "Jay" },
    ...overrides,
  };
}

describe("processTrainerResumeSignupNudges", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    draftFindManyMock.mockResolvedValue([]);
    trainerFindUniqueMock.mockResolvedValue(null);
    sendResumeEmailMock.mockResolvedValue({ ok: true, resendId: "resend_1" });
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-07T12:00:00.000Z"));
  });

  it("sends the resume email for an eligible draft and marks resumeEmailSentAt", async () => {
    draftFindManyMock.mockResolvedValue([draft()]);

    const summary = await processTrainerResumeSignupNudges();

    expect(sendResumeEmailMock).toHaveBeenCalledWith({ email: "coach@example.com", firstName: "Jay" });
    expect(draftUpdateMock).toHaveBeenCalledWith({
      where: { id: "draft_1" },
      data: { resumeEmailSentAt: new Date("2026-08-07T12:00:00.000Z") },
    });
    expect(summary).toEqual({ sent: 1, skipped: 0, errors: 0 });
  });

  it("skips and marks sent without emailing when the trainer already finished signing up", async () => {
    draftFindManyMock.mockResolvedValue([draft()]);
    trainerFindUniqueMock.mockResolvedValue({ id: "trainer_1" });

    const summary = await processTrainerResumeSignupNudges();

    expect(sendResumeEmailMock).not.toHaveBeenCalled();
    expect(draftUpdateMock).toHaveBeenCalledWith({
      where: { id: "draft_1" },
      data: { resumeEmailSentAt: new Date("2026-08-07T12:00:00.000Z") },
    });
    expect(summary).toEqual({ sent: 0, skipped: 1, errors: 0 });
  });

  it("skips a draft with no email without calling the trainer lookup or sending", async () => {
    draftFindManyMock.mockResolvedValue([draft({ email: null })]);

    const summary = await processTrainerResumeSignupNudges();

    expect(trainerFindUniqueMock).not.toHaveBeenCalled();
    expect(sendResumeEmailMock).not.toHaveBeenCalled();
    expect(summary).toEqual({ sent: 0, skipped: 1, errors: 0 });
  });

  it("skips without counting an error when no confirmed auth user exists yet", async () => {
    draftFindManyMock.mockResolvedValue([draft()]);
    sendResumeEmailMock.mockResolvedValue({ ok: false, code: "SUPABASE_USER_MISSING", error: "no user" });

    const summary = await processTrainerResumeSignupNudges();

    expect(draftUpdateMock).not.toHaveBeenCalled();
    expect(summary).toEqual({ sent: 0, skipped: 1, errors: 0 });
  });

  it("counts an error and does not mark sent when delivery fails for another reason", async () => {
    draftFindManyMock.mockResolvedValue([draft()]);
    sendResumeEmailMock.mockResolvedValue({ ok: false, code: "SEND_FAILED", error: "resend down" });

    const summary = await processTrainerResumeSignupNudges();

    expect(draftUpdateMock).not.toHaveBeenCalled();
    expect(summary).toEqual({ sent: 0, skipped: 0, errors: 1 });
  });

  it("processes multiple candidates independently", async () => {
    draftFindManyMock.mockResolvedValue([
      draft({ id: "draft_a", email: "a@example.com" }),
      draft({ id: "draft_b", email: "b@example.com" }),
    ]);
    sendResumeEmailMock
      .mockResolvedValueOnce({ ok: true, resendId: "r1" })
      .mockResolvedValueOnce({ ok: false, code: "SEND_FAILED", error: "boom" });

    const summary = await processTrainerResumeSignupNudges();

    expect(sendResumeEmailMock).toHaveBeenCalledTimes(2);
    expect(summary).toEqual({ sent: 1, skipped: 0, errors: 1 });
  });
});
