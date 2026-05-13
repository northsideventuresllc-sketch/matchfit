import { RESEND_ONBOARDING_FROM, sendResendEmail } from "@/lib/resend-client";

export const MATCH_FIT_SUPPORT_FROM = "Match Fit <support@match-fit.net>";

/**
 * Production transactional From line; development uses {@link RESEND_ONBOARDING_FROM} via {@link sendResendEmail}.
 */
export function matchFitBrandedFromHeader(): string {
  return process.env.NODE_ENV === "development" ? RESEND_ONBOARDING_FROM : MATCH_FIT_SUPPORT_FROM;
}

export async function sendMatchFitBrandedEmail(params: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
}): Promise<string | undefined> {
  return await sendResendEmail({
    from: matchFitBrandedFromHeader(),
    to: params.to.trim(),
    subject: params.subject,
    text: params.text,
    html: params.html,
    replyTo: params.replyTo,
  });
}
