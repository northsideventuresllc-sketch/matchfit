import {
  matchFitProductionFromHeader,
  MATCH_FIT_NOREPLY_FROM,
  RESEND_ONBOARDING_FROM,
  sendResendEmail,
} from "@/lib/resend-client";

/** @deprecated Use {@link MATCH_FIT_NOREPLY_FROM}. */
export const MATCH_FIT_SUPPORT_FROM = MATCH_FIT_NOREPLY_FROM;

/**
 * Production transactional From line; development uses {@link RESEND_ONBOARDING_FROM} via {@link sendResendEmail}.
 */
export function matchFitBrandedFromHeader(): string {
  return process.env.NODE_ENV === "development" ? RESEND_ONBOARDING_FROM : matchFitProductionFromHeader();
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
