import { prisma } from "@/lib/prisma";
import { sendTrainerResumeSignupEmail } from "@/lib/trainer-resume-signup-email";

/**
 * Zero-Sales Signup Engine (G3, JB locked 2026-07-22) — automated resume-signup
 * nudge. A trainer confirmed their email (TrainerDraft exists) but never finished
 * the Fitness Pro agreement (no Trainer row). Nudge once, ~1h after the draft was
 * last touched, then never again for that draft.
 *
 * Approve-only (JB ruled 2026-08-20 — NI-Brain Decision #1280 / Learning #7461):
 * this cron only ever queues a PendingTrainerResumeSignupNudge row. It never calls
 * sendTrainerResumeSignupEmail itself — an admin must explicitly approve each one
 * via approveTrainerResumeSignupNudge before a real trainer gets emailed.
 */
const NUDGE_AFTER_MS = 60 * 60 * 1000; // 1h
const STOP_NUDGING_AFTER_MS = 30 * 24 * 60 * 60 * 1000; // 30d — stale drafts are dead, not nudged
const MAX_PER_RUN = 25;

export async function processTrainerResumeSignupNudges(): Promise<{
  queued: number;
  skipped: number;
  errors: number;
}> {
  const now = Date.now();
  const cutoff = new Date(now - NUDGE_AFTER_MS);
  const floor = new Date(now - STOP_NUDGING_AFTER_MS);

  const candidates = await prisma.trainerDraft.findMany({
    where: {
      email: { not: null },
      resumeEmailSentAt: null,
      updatedAt: { lte: cutoff, gte: floor },
    },
    orderBy: { updatedAt: "asc" },
    take: MAX_PER_RUN,
  });

  let queued = 0;
  let skipped = 0;
  let errors = 0;

  for (const draft of candidates) {
    const email = draft.email?.trim().toLowerCase();
    if (!email) {
      skipped++;
      continue;
    }

    const completed = await prisma.trainer.findUnique({ where: { email }, select: { id: true } });
    if (completed) {
      // Signup finished after all — mark as sent so we never re-check this draft.
      await prisma.trainerDraft.update({
        where: { id: draft.id },
        data: { resumeEmailSentAt: new Date() },
      });
      skipped++;
      continue;
    }

    const existingPending = await prisma.pendingTrainerResumeSignupNudge.findUnique({
      where: { trainerDraftId: draft.id },
    });
    if (existingPending) {
      // Already queued (pending, sent, or denied) — never queue the same draft twice.
      skipped++;
      continue;
    }

    try {
      const data = (draft.data ?? {}) as { firstName?: string };
      await prisma.pendingTrainerResumeSignupNudge.create({
        data: { trainerDraftId: draft.id, email, firstName: data.firstName ?? null },
      });
      queued++;
    } catch (err) {
      console.error("[trainer resume signup nudge] queue", draft.id, err);
      errors++;
    }
  }

  return { queued, skipped, errors };
}

export type PendingTrainerResumeSignupNudgeSummary = {
  id: string;
  trainerDraftId: string;
  email: string;
  firstName: string | null;
  createdAt: Date;
};

/** Nudges awaiting explicit admin approval before the resume email goes out. */
export async function listPendingTrainerResumeSignupNudges(): Promise<PendingTrainerResumeSignupNudgeSummary[]> {
  return prisma.pendingTrainerResumeSignupNudge.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    select: { id: true, trainerDraftId: true, email: true, firstName: true, createdAt: true },
  });
}

export type NudgeDecisionResult = { ok: true } | { ok: false; error: string };

/** Admin-approved: sends the resume email now and marks the draft nudged. */
export async function approveTrainerResumeSignupNudge(id: string, adminId: string): Promise<NudgeDecisionResult> {
  const pending = await prisma.pendingTrainerResumeSignupNudge.findUnique({ where: { id } });
  if (!pending || pending.status !== "PENDING") {
    return { ok: false, error: "Nudge not found or already decided." };
  }

  const result = await sendTrainerResumeSignupEmail({
    email: pending.email,
    firstName: pending.firstName ?? undefined,
  });
  if (!result.ok) {
    // Left PENDING on purpose — e.g. SUPABASE_USER_MISSING can resolve itself; an
    // admin can retry the approval later instead of the cron silently re-sending.
    return { ok: false, error: result.error };
  }

  await prisma.$transaction([
    prisma.pendingTrainerResumeSignupNudge.update({
      where: { id },
      data: { status: "SENT", decidedAt: new Date(), decidedByAdminId: adminId },
    }),
    prisma.trainerDraft.update({
      where: { id: pending.trainerDraftId },
      data: { resumeEmailSentAt: new Date() },
    }),
  ]);
  return { ok: true };
}

/** Admin-denied: never sends; closes the nudge out so the draft is not re-queued. */
export async function denyTrainerResumeSignupNudge(id: string, adminId: string): Promise<NudgeDecisionResult> {
  const pending = await prisma.pendingTrainerResumeSignupNudge.findUnique({ where: { id } });
  if (!pending || pending.status !== "PENDING") {
    return { ok: false, error: "Nudge not found or already decided." };
  }
  await prisma.pendingTrainerResumeSignupNudge.update({
    where: { id },
    data: { status: "DENIED", decidedAt: new Date(), decidedByAdminId: adminId },
  });
  return { ok: true };
}
