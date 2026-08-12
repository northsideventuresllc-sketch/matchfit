import "server-only";

import { prisma } from "@/lib/prisma";
import { appBaseUrlForEmail } from "@/lib/match-fit-email-shell";
import { sendTransactionalEmailIfAllowed } from "@/lib/transactional-email-send";
import { ownerTestExcludedSignupProgressWhere } from "@/lib/owner-test-account-exclusion";
import {
  isDueForNextSignupFollowup,
  nextSignupFollowupKind,
  signupResumePathForRole,
  SIGNUP_FOLLOWUP_MAX_COUNT,
} from "@/lib/signup-abandonment-followup";
import type { SignupProgressRole } from "@/lib/signup-progress-reporter";

/** Cap per cron tick — plenty for a 15-minute cadence, keeps each run fast. */
const BATCH_SIZE = 200;

export type SignupAbandonmentFollowupSummary = {
  candidatesScanned: number;
  sent: number;
  skippedAlreadyHasAccount: number;
  errors: number;
};

async function alreadyHasAccount(role: SignupProgressRole, email: string): Promise<boolean> {
  if (role === "trainer") {
    const row = await prisma.trainer.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true },
    });
    return row !== null;
  }
  const row = await prisma.client.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true },
  });
  return row !== null;
}

async function runForRole(role: SignupProgressRole, now: Date): Promise<SignupAbandonmentFollowupSummary> {
  const summary: SignupAbandonmentFollowupSummary = {
    candidatesScanned: 0,
    sent: 0,
    skippedAlreadyHasAccount: 0,
    errors: 0,
  };

  const rows = await prisma.signupFormProgress.findMany({
    where: {
      role,
      email: { not: null },
      stage: { not: "completed" },
      followupEmailsSent: { lt: SIGNUP_FOLLOWUP_MAX_COUNT },
      ...ownerTestExcludedSignupProgressWhere(role),
    },
    orderBy: { updatedAt: "asc" },
    take: BATCH_SIZE,
  });

  summary.candidatesScanned = rows.length;
  const base = appBaseUrlForEmail().replace(/\/$/, "");
  const resumeUrl = `${base}${signupResumePathForRole(role)}`;

  for (const row of rows) {
    const email = row.email?.trim();
    if (!email) continue;
    if (!isDueForNextSignupFollowup({ followupEmailsSent: row.followupEmailsSent, updatedAt: row.updatedAt, now })) {
      continue;
    }
    const kind = nextSignupFollowupKind(role, row.followupEmailsSent);
    if (!kind) continue;

    try {
      // A visitor may have finished signing up through a different flow/device without this
      // row's stage ever being marked "completed" (e.g. a race, or they logged in directly).
      // Do not nudge someone who already has a real account.
      if (await alreadyHasAccount(role, email)) {
        summary.skippedAlreadyHasAccount += 1;
        await prisma.signupFormProgress.update({
          where: { id: row.id },
          data: { followupEmailsSent: SIGNUP_FOLLOWUP_MAX_COUNT, lastFollowupSentAt: now },
        });
        continue;
      }

      await sendTransactionalEmailIfAllowed({
        kind,
        to: email,
        audience: role === "trainer" ? "TRAINER" : "CLIENT",
        variables: { signupResumeUrl: resumeUrl },
      });

      await prisma.signupFormProgress.update({
        where: { id: row.id },
        data: { followupEmailsSent: row.followupEmailsSent + 1, lastFollowupSentAt: now },
      });
      summary.sent += 1;
    } catch (e) {
      summary.errors += 1;
      console.error(`[signup abandonment followup] ${role} row ${row.id}`, e);
    }
  }

  return summary;
}

function mergeSummaries(
  a: SignupAbandonmentFollowupSummary,
  b: SignupAbandonmentFollowupSummary,
): SignupAbandonmentFollowupSummary {
  return {
    candidatesScanned: a.candidatesScanned + b.candidatesScanned,
    sent: a.sent + b.sent,
    skippedAlreadyHasAccount: a.skippedAlreadyHasAccount + b.skippedAlreadyHasAccount,
    errors: a.errors + b.errors,
  };
}

/**
 * Sends the 3-email abandoned-signup follow-up sequence (see signup-abandonment-followup.ts
 * for spacing) for both trainer and client rows. Safe to call every 15 minutes: each row is
 * only ever advanced past its current followupEmailsSent count after a send attempt, and the
 * 1h/24h/72h spacing means a crash between "email sent" and "counter updated" (the only window
 * that could double-send) would need the whole process to die in that exact instant to matter —
 * and even then the visitor gets one extra reminder, not a billing event or repeated spam.
 */
export async function runSignupAbandonmentFollowupJobs(): Promise<SignupAbandonmentFollowupSummary> {
  const now = new Date();
  const trainer = await runForRole("trainer", now);
  const client = await runForRole("client", now);
  return mergeSummaries(trainer, client);
}
