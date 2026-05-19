import { sendMatchFitBrandedEmail } from "@/lib/match-fit-branded-email";
import { escapeHtmlEmail, wrapMatchFitTransactionalHtml } from "@/lib/match-fit-email-shell";
import { MF_EMAIL_SITE } from "@/lib/match-fit-email-brand";

function trialEmailBodyParagraphs(htmlLines: string[]): string {
  const s = MF_EMAIL_SITE;
  return htmlLines
    .map(
      (line) =>
        `<p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:${s.textMuted};text-align:center;max-width:480px;margin-left:auto;margin-right:auto;">${line}</p>`,
    )
    .join("");
}

/** Billing-critical trial reminders — always sent when cron triggers. */
export async function sendClientTrialEndingEmail(args: {
  email: string;
  firstName: string;
  hoursUntilBill: number;
  monthlyLabel: string;
  windowLabel: string;
}): Promise<boolean> {
  const billingUrl = `${process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "https://match-fit.net"}/client/dashboard/billing`;
  const subject = `Your Match Fit trial ends in about ${args.hoursUntilBill} hour(s)`;
  const text = `Hi ${args.firstName},\n\nYour ${args.windowLabel} ends in about ${args.hoursUntilBill} hour(s). Your card on file will be charged ${args.monthlyLabel} for your monthly platform subscription unless you cancel before then.\n\nYou can pay now or manage billing: ${billingUrl}\n\n— Match Fit`;

  const html = wrapMatchFitTransactionalHtml({
    preheader: "Your free access is ending soon.",
    title: "Trial ending soon",
    bodyHtml: trialEmailBodyParagraphs([
      `Hi <strong style="color:#F4F6FA;">${escapeHtmlEmail(args.firstName)}</strong>,`,
      `Your <strong>${escapeHtmlEmail(args.windowLabel)}</strong> ends in about <strong>${args.hoursUntilBill}</strong> hour(s). Your card on file will be charged <strong>${escapeHtmlEmail(args.monthlyLabel)}</strong> for monthly platform access unless you cancel before billing starts.`,
      "You can pay now from Billing settings if you prefer not to wait.",
    ]),
    ctaHref: billingUrl,
    ctaLabel: "Manage billing",
  });

  await sendMatchFitBrandedEmail({ to: args.email, subject, text, html });
  return true;
}
