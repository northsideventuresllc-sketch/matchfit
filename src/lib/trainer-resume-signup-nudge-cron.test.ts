import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  draftFindManyMock,
  draftUpdateMock,
  trainerFindUniqueMock,
  pendingFindUniqueMock,
  pendingFindManyMock,
  pendingCreateMock,
  pendingUpdateMock,
  transactionMock,
  sendResumeEmailMock,
} = vi.hoisted(() => ({
  draftFindManyMock: vi.fn(),
  draftUpdateMock: vi.fn(),
  trainerFindUniqueMock: vi.fn(),
  pendingFindUniqueMock: vi.fn(),
  pendingFindManyMock: vi.fn(),
  pendingCreateMock: vi.fn(),
  pendingUpdateMock: vi.fn(),
  transactionMock: vi.fn(),
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
    pendingTrainerResumeSignupNudge: {
      findUnique: pendingFindUniqueMock,
      findMany: pendingFindManyMock,
      create: pendingCreateMock,
      update: pendingUpdateMock,
    },
    $transaction: transactionMock,
  },
}));

vi.mock("@/lib/trainer-resume-signup-email", () => ({
  sendTrainerResumeSignupEmail: sendResumeEmailMock,
}));

import {
  approveTrainerResumeSignupNudge,
  denyTrainerResumeSignupNudge,
  listPendingTrainerResumeSignupNudges,
  processTrainerResumeSignupNudges,
} from "@/lib/trainer-resume-signup-nudge-cron";

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
    pendingFindUniqueMock.mockResolvedValue(null);
    pendingCreateMock.mockResolvedValue({});
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-07T12:00:00.000Z"));
  });

  it("queues a pending nudge for an eligible draft without sending anything", async () => {
    draftFindManyMock.mockResolvedValue([draft()]);

    const summary = await processTrainerResumeSignupNudges();

    expect(sendResumeEmailMock).not.toHaveBeenCalled();
    expect(pendingCreateMock).toHaveBeenCalledWith({
      data: { trainerDraftId: "draft_1", email: "coach@example.com", firstName: "Jay" },
    });
    expect(draftUpdateMock).not.toHaveBeenCalled();
    expect(summary).toEqual({ queued: 1, skipped: 0, errors: 0 });
  });

  it("skips and marks sent without queuing when the trainer already finished signing up", async () => {
    draftFindManyMock.mockResolvedValue([draft()]);
    trainerFindUniqueMock.mockResolvedValue({ id: "trainer_1" });

    const summary = await processTrainerResumeSignupNudges();

    expect(pendingCreateMock).not.toHaveBeenCalled();
    expect(draftUpdateMock).toHaveBeenCalledWith({
      where: { id: "draft_1" },
      data: { resumeEmailSentAt: new Date("2026-08-07T12:00:00.000Z") },
    });
    expect(summary).toEqual({ queued: 0, skipped: 1, errors: 0 });
  });

  it("skips a draft with no email without calling the trainer lookup or queuing", async () => {
    draftFindManyMock.mockResolvedValue([draft({ email: null })]);

    const summary = await processTrainerResumeSignupNudges();

    expect(trainerFindUniqueMock).not.toHaveBeenCalled();
    expect(pendingCreateMock).not.toHaveBeenCalled();
    expect(summary).toEqual({ queued: 0, skipped: 1, errors: 0 });
  });

  it("skips a draft that already has a pending nudge queued", async () => {
    draftFindManyMock.mockResolvedValue([draft()]);
    pendingFindUniqueMock.mockResolvedValue({ id: "pending_1", status: "PENDING" });

    const summary = await processTrainerResumeSignupNudges();

    expect(pendingCreateMock).not.toHaveBeenCalled();
    expect(summary).toEqual({ queued: 0, skipped: 1, errors: 0 });
  });

  it("counts an error when queuing fails", async () => {
    draftFindManyMock.mockResolvedValue([draft()]);
    pendingCreateMock.mockRejectedValue(new Error("db down"));

    const summary = await processTrainerResumeSignupNudges();

    expect(summary).toEqual({ queued: 0, skipped: 0, errors: 1 });
  });

  it("processes multiple candidates independently", async () => {
    draftFindManyMock.mockResolvedValue([
      draft({ id: "draft_a", email: "a@example.com" }),
      draft({ id: "draft_b", email: "b@example.com" }),
    ]);

    const summary = await processTrainerResumeSignupNudges();

    expect(pendingCreateMock).toHaveBeenCalledTimes(2);
    expect(summary).toEqual({ queued: 2, skipped: 0, errors: 0 });
  });
});

describe("listPendingTrainerResumeSignupNudges", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns only PENDING nudges, oldest first", async () => {
    pendingFindManyMock.mockResolvedValue([{ id: "p1" }]);

    const result = await listPendingTrainerResumeSignupNudges();

    expect(pendingFindManyMock).toHaveBeenCalledWith({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      select: { id: true, trainerDraftId: true, email: true, firstName: true, createdAt: true },
    });
    expect(result).toEqual([{ id: "p1" }]);
  });
});

describe("approveTrainerResumeSignupNudge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-07T12:00:00.000Z"));
  });

  it("sends the email and marks the nudge SENT + the draft nudged", async () => {
    pendingFindUniqueMock.mockResolvedValue({
      id: "p1",
      trainerDraftId: "draft_1",
      email: "coach@example.com",
      firstName: "Jay",
      status: "PENDING",
    });
    sendResumeEmailMock.mockResolvedValue({ ok: true, resendId: "r1" });

    const result = await approveTrainerResumeSignupNudge("p1", "admin_1");

    expect(sendResumeEmailMock).toHaveBeenCalledWith({ email: "coach@example.com", firstName: "Jay" });
    expect(transactionMock).toHaveBeenCalled();
    expect(result).toEqual({ ok: true });
  });

  it("does not send and returns an error when the nudge is not pending", async () => {
    pendingFindUniqueMock.mockResolvedValue({ id: "p1", status: "SENT" });

    const result = await approveTrainerResumeSignupNudge("p1", "admin_1");

    expect(sendResumeEmailMock).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: false, error: "Nudge not found or already decided." });
  });

  it("leaves the nudge PENDING when delivery fails", async () => {
    pendingFindUniqueMock.mockResolvedValue({
      id: "p1",
      trainerDraftId: "draft_1",
      email: "coach@example.com",
      firstName: "Jay",
      status: "PENDING",
    });
    sendResumeEmailMock.mockResolvedValue({ ok: false, code: "SUPABASE_USER_MISSING", error: "no user" });

    const result = await approveTrainerResumeSignupNudge("p1", "admin_1");

    expect(transactionMock).not.toHaveBeenCalled();
    expect(pendingUpdateMock).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: false, error: "no user" });
  });
});

describe("denyTrainerResumeSignupNudge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-07T12:00:00.000Z"));
  });

  it("marks the nudge DENIED without sending anything", async () => {
    pendingFindUniqueMock.mockResolvedValue({ id: "p1", status: "PENDING" });

    const result = await denyTrainerResumeSignupNudge("p1", "admin_1");

    expect(sendResumeEmailMock).not.toHaveBeenCalled();
    expect(pendingUpdateMock).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { status: "DENIED", decidedAt: new Date("2026-08-07T12:00:00.000Z"), decidedByAdminId: "admin_1" },
    });
    expect(result).toEqual({ ok: true });
  });

  it("returns an error when the nudge is not pending", async () => {
    pendingFindUniqueMock.mockResolvedValue({ id: "p1", status: "DENIED" });

    const result = await denyTrainerResumeSignupNudge("p1", "admin_1");

    expect(pendingUpdateMock).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: false, error: "Nudge not found or already decided." });
  });
});
