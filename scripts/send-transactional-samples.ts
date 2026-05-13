/**
 * Send sample transactional emails via Resend.
 * Use NODE_ENV=development when testing locally so outbound mail uses onboarding@resend.dev
 * and the dev-inbox rules in src/lib/resend-client.ts apply.
 *
 * Example:
 *   NODE_ENV=development node --env-file=.env npx tsx scripts/send-transactional-samples.ts POLICY_UPDATE
 */
import type { TransactionalEmailKind } from "../src/lib/transactional-email-kinds";
import { formatTransactionalEmailSubject } from "../src/lib/match-fit-email-shell";
import { RESEND_DEV_INBOX } from "../src/lib/resend-client";
import { sendMatchFitBrandedEmail } from "../src/lib/match-fit-branded-email";
import { TRANSACTIONAL_EMAIL_KINDS, transactionalEmailKindSampleLabel } from "../src/lib/transactional-email-kinds";
import { buildTransactionalEmail, sampleContextForTransactionalEmail } from "../src/lib/transactional-email-templates";

void (async () => {
  const arg = process.argv[2]?.trim();
  const kinds: TransactionalEmailKind[] = arg
    ? TRANSACTIONAL_EMAIL_KINDS.filter((k): k is TransactionalEmailKind => k === arg)
    : [...TRANSACTIONAL_EMAIL_KINDS];
  if (arg && kinds.length === 0) {
    console.error(`Unknown kind "${arg}". Valid: ${TRANSACTIONAL_EMAIL_KINDS.join(", ")}`);
    process.exit(1);
  }
  if (process.env.NODE_ENV !== "development") {
    console.warn(
      "Warning: NODE_ENV is not 'development'. Use NODE_ENV=development so Resend uses onboarding@resend.dev and the dev inbox redirect matches local testing.",
    );
  }
  for (const kind of kinds) {
    const ctx = sampleContextForTransactionalEmail(kind);
    const { subject, text, html } = buildTransactionalEmail(kind, ctx);
    const stamp = kinds.length === 1 ? ` (${new Date().toISOString()})` : "";
    const id = await sendMatchFitBrandedEmail({
      to: RESEND_DEV_INBOX,
      subject: formatTransactionalEmailSubject(
        `[Sample] ${transactionalEmailKindSampleLabel(kind)} — ${subject}${stamp}`,
      ),
      text: `Template kind: ${kind}\n\n${text}`,
      html,
    });
    console.log("sent", kind, id ? `resend_id=${id}` : "(no id in response)");
    await new Promise((r) => setTimeout(r, 260));
  }
  console.log("done", kinds.length);
})();
