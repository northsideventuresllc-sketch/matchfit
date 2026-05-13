import { ADMIN_APPROVAL_INBOX } from "@/lib/admin-approval-inbox";
import { deriveAdministratorCode } from "@/lib/admin-code";
import { signAdminPendingDecisionToken } from "@/lib/admin-pending-decision-token";
import { sendTransactionalEmailIfAllowed } from "@/lib/transactional-email-send";

export async function sendAdministratorSignupReviewEmail(opts: {
  pendingId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  email: string;
  origin: string;
}): Promise<void> {
  const proposed = deriveAdministratorCode(opts.firstName, opts.lastName, opts.dateOfBirth);
  const approveTok = await signAdminPendingDecisionToken(opts.pendingId, "approve");
  const denyTok = await signAdminPendingDecisionToken(opts.pendingId, "deny");
  const approveUrl = `${opts.origin}/api/admin/pending-decision?token=${encodeURIComponent(approveTok)}`;
  const denyUrl = `${opts.origin}/api/admin/pending-decision?token=${encodeURIComponent(denyTok)}`;

  await sendTransactionalEmailIfAllowed({
    kind: "ADMIN_REGISTRATION_REQUEST",
    to: ADMIN_APPROVAL_INBOX.trim(),
    audience: "STAFF",
    variables: {
      adminName: `${opts.firstName} ${opts.lastName}`.trim(),
      adminEmail: opts.email,
      approveUrl,
      denyUrl,
      adminNotes: `DOB ${opts.dateOfBirth} · Proposed admin code: ${proposed ?? "—"}`,
    },
  });
}
