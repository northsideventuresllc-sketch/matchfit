/**
 * Send one production-like transactional email (no [Sample] prefix, fictional data).
 * Run:
 *   NODE_ENV=development node --env-file=.env npx tsx scripts/send-realistic-sample.ts
 */
import { sendMatchFitBrandedEmail } from "../src/lib/match-fit-branded-email";
import { buildTransactionalEmail } from "../src/lib/transactional-email-templates";
import { RESEND_DEV_INBOX } from "../src/lib/resend-client";

/** Rich fake context — every placeholder filled as if the event just happened. */
const KIND = "NEW_CLIENT_INQUIRY" as const;

void (async () => {
  const ctx: Record<string, string> = {
    firstName: "Jordan",
    trainerDashboardUrl: "https://match-fit.net/trainer/dashboard",
    trainerUsername: "jordan.banks.coach",
    clientUsername: "morgan.lee.athletics",
    inquiryNote:
      "Morgan viewed your 12-week Hypertrophy block, saved your profile, and asked about April start dates and remote check-ins.",
    interestsUrl: "https://match-fit.net/trainer/dashboard/interests",
    dashboardUrl: "https://match-fit.net/client",
  };

  const { subject, text, html } = buildTransactionalEmail(KIND, ctx);
  const id = await sendMatchFitBrandedEmail({
    to: RESEND_DEV_INBOX,
    subject,
    text,
    html,
    replyTo: "support@match-fit.net",
  });
  console.log("sent", KIND);
  console.log("subject:", subject);
  console.log(id ? `resend_id=${id}` : "(no id)");
})();
