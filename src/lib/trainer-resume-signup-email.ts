import "server-only";
import { MF_EMAIL_SITE } from "@/lib/match-fit-email-brand";
import {
  escapeHtmlEmail,
  formatTransactionalEmailSubject,
  wrapMatchFitTransactionalHtml,
} from "@/lib/match-fit-email-shell";
import { sendMatchFitBrandedEmail } from "@/lib/match-fit-branded-email";
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin-client";
import { findSupabaseAuthUserByEmail } from "@/lib/supabase/find-auth-user-by-email";
import { getSupabaseEmailCallbackUrl } from "@/lib/supabase/email-callback-url";

export type SendTrainerResumeSignupResult =
  | { ok: true; resendId?: string }
  | { ok: false; error: string; code: string };

/**
 * "Resume your application" rescue email for trainers who confirmed their email but
 * never finished the Fitness Pro agreement (no Trainer row was ever created). Sends a
 * fresh Supabase magic link — clicking it lands the trainer back on
 * `/trainer/signup/complete`, where the server-side draft (see
 * `sendSupabaseSignupVerificationEmail`) fills the form back in.
 *
 * Wired to the match-fit-tos-jobs cron (every 15 min) via
 * processTrainerResumeSignupNudges — see trainer-resume-signup-nudge-cron.ts.
 */
export async function sendTrainerResumeSignupEmail(args: {
  email: string;
  firstName?: string;
}): Promise<SendTrainerResumeSignupResult> {
  if (!isSupabaseAdminConfigured()) {
    return { ok: false, code: "SUPABASE_ADMIN_NOT_CONFIGURED", error: "Resume email delivery is not configured." };
  }
  if (!process.env.RESEND_API_KEY?.trim()) {
    return { ok: false, code: "RESEND_NOT_CONFIGURED", error: "Resume email delivery is not configured." };
  }

  const email = args.email.trim().toLowerCase();
  const firstName = args.firstName?.trim() || "Coach";

  try {
    const authUser = await findSupabaseAuthUserByEmail(email);
    if (!authUser) {
      return { ok: false, code: "SUPABASE_USER_MISSING", error: "No sign-up record found for this email." };
    }

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: getSupabaseEmailCallbackUrl() },
    });
    if (error) {
      console.error("[sendTrainerResumeSignupEmail] generateLink", error);
      return { ok: false, code: "GENERATE_LINK_FAILED", error: error.message?.trim() || "Could not create a resume link." };
    }

    const resumeUrl = data?.properties?.action_link?.trim();
    if (!resumeUrl) {
      return { ok: false, code: "MISSING_RESUME_LINK", error: "Could not create a resume link." };
    }

    const subject = formatTransactionalEmailSubject("Finish your Match Fit coach application");
    const text = [
      `Hi ${firstName},`,
      "",
      "You're almost set up as a Match Fit coach — you just haven't finished the Fitness Pro agreement yet.",
      "",
      `Resume your application: ${resumeUrl}`,
      "",
      "If you didn't mean to sign up, you can ignore this message.",
      "",
      "— Match Fit",
    ].join("\n");

    const s = MF_EMAIL_SITE;
    const bodyHtml = `<p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:${s.textMuted};text-align:center;max-width:480px;margin-left:auto;margin-right:auto;">Hi ${escapeHtmlEmail(firstName)}, you're almost set up as a Match Fit coach — you just haven&rsquo;t finished the Fitness Pro agreement yet.</p>`;
    const html = wrapMatchFitTransactionalHtml({
      preheader: "Finish your Match Fit coach application.",
      title: "Resume your application",
      bodyHtml,
      ctaHref: resumeUrl,
      ctaLabel: "Resume application",
    });

    const resendId = await sendMatchFitBrandedEmail({
      to: email,
      subject,
      text,
      html,
      replyTo: "support@match-fit.net",
    });

    return { ok: true, resendId };
  } catch (e) {
    console.error("[sendTrainerResumeSignupEmail]", e);
    return { ok: false, code: "SEND_FAILED", error: "Could not send the resume email." };
  }
}
