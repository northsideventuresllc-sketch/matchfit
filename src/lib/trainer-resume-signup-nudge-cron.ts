import { prisma } from "@/lib/prisma";
import { sendTrainerResumeSignupEmail } from "@/lib/trainer-resume-signup-email";

/**
 * Zero-Sales Signup Engine (G3, JB locked 2026-07-22) — automated resume-signup
 * nudge. A trainer confirmed their email (TrainerDraft exists) but never finished
 * the Fitness Pro agreement (no Trainer row). Nudge once, ~1h after the draft was
 * last touched, then never again for that draft.
 */
const NUDGE_AFTER_MS = 60 * 60 * 1000; // 1h
const STOP_NUDGING_AFTER_MS = 30 * 24 * 60 * 60 * 1000; // 30d — stale drafts are dead, not nudged
const MAX_PER_RUN = 25;

export async function processTrainerResumeSignupNudges(): Promise<{
  sent: number;
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

  let sent = 0;
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

    const data = (draft.data ?? {}) as { firstName?: string };
    const result = await sendTrainerResumeSignupEmail({ email, firstName: data.firstName });

    if (result.ok) {
      await prisma.trainerDraft.update({
        where: { id: draft.id },
        data: { resumeEmailSentAt: new Date() },
      });
      sent++;
    } else if (result.code === "SUPABASE_USER_MISSING") {
      // No confirmed auth user for this email — nothing to resume yet, try again later.
      skipped++;
    } else {
      console.error("[trainer resume signup nudge]", draft.id, result.code, result.error);
      errors++;
    }
  }

  return { sent, skipped, errors };
}
