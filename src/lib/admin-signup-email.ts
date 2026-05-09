import { ADMIN_APPROVAL_INBOX } from "@/lib/admin-approval-inbox";
import { deriveAdministratorCode } from "@/lib/admin-code";
import { signAdminPendingDecisionToken } from "@/lib/admin-pending-decision-token";
import { sendResendEmail } from "@/lib/resend-client";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

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

  const text = [
    "Someone submitted the Match Fit administrator onboarding form.",
    "",
    `Name: ${opts.firstName} ${opts.lastName}`,
    `Date of birth (YYYY-MM-DD): ${opts.dateOfBirth}`,
    `Email (login): ${opts.email}`,
    `Derived admin code (if approved): ${proposed ?? "(could not derive — check names/DOB format)"}`,
    "",
    "Approve (creates the administrator account):",
    approveUrl,
    "",
    "Deny (marks request denied):",
    denyUrl,
    "",
    "If you did not expect this message, use Deny and investigate.",
  ].join("\n");

  const html = `
<p>A new <strong>Match Fit administrator</strong> request was submitted.</p>
<ul>
  <li><strong>Name:</strong> ${escapeHtml(`${opts.firstName} ${opts.lastName}`)}</li>
  <li><strong>Date of birth:</strong> ${escapeHtml(opts.dateOfBirth)}</li>
  <li><strong>Email:</strong> ${escapeHtml(opts.email)}</li>
  <li><strong>Derived admin code:</strong> ${escapeHtml(proposed ?? "—")}</li>
</ul>
<p style="margin-top:1.5rem">
  <a href="${approveUrl}" style="display:inline-block;padding:12px 18px;background:#15803d;color:#fff;text-decoration:none;border-radius:10px;font-weight:700;">Approve administrator</a>
  &nbsp;&nbsp;
  <a href="${denyUrl}" style="display:inline-block;padding:12px 18px;background:#b91c1c;color:#fff;text-decoration:none;border-radius:10px;font-weight:700;">Deny</a>
</p>
<p style="margin-top:1rem;font-size:13px;color:#555">Plain links are repeated in the text version of this email.</p>
`.trim();

  await sendResendEmail({
    to: ADMIN_APPROVAL_INBOX,
    subject: `[Match Fit] Administrator approval — ${opts.firstName} ${opts.lastName}`,
    text,
    html,
  });
}
