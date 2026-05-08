import { RESEND_ONBOARDING_FROM, sendResendEmail } from "@/lib/resend-client";

/** From-address for automated trainer→client digests (verify domain in Resend for production). */
export const MATCHFIT_TRAINER_DIGEST_FROM =
  process.env.MATCHFIT_TRAINER_FROM_EMAIL?.trim() || "trainer@matchfit.com";

export async function sendTrainerClientDigestEmail(args: {
  toClientEmail: string;
  subject: string;
  textBody: string;
}): Promise<void> {
  const from = MATCHFIT_TRAINER_DIGEST_FROM || RESEND_ONBOARDING_FROM;
  await sendResendEmail({
    from,
    to: args.toClientEmail,
    subject: args.subject,
    text: args.textBody,
  });
}
