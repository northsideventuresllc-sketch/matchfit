import "server-only";
import { prisma } from "@/lib/prisma";
import { MF_EMAIL_SITE } from "@/lib/match-fit-email-brand";
import {
  escapeHtmlEmail,
  formatTransactionalEmailSubject,
  wrapMatchFitTransactionalHtml,
} from "@/lib/match-fit-email-shell";
import { sendMatchFitBrandedEmail } from "@/lib/match-fit-branded-email";
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin-client";
import { getSupabaseEmailCallbackUrl } from "@/lib/supabase/email-callback-url";

export type SupabaseSignupVerificationRole = "trainer" | "client";

export type SendSupabaseSignupVerificationResult =
  | { ok: true; resendId?: string }
  | { ok: false; error: string; code: string };

function buildVerificationEmail(args: {
  role: SupabaseSignupVerificationRole;
  firstName?: string;
  confirmUrl: string;
}): { subject: string; text: string; html: string } {
  const firstName = args.firstName?.trim() || (args.role === "trainer" ? "Coach" : "there");
  const roleLabel = args.role === "trainer" ? "coach" : "client";
  const subject = formatTransactionalEmailSubject("Confirm your Match Fit email");
  const text = [
    `Hi ${firstName},`,
    "",
    `Confirm your email to finish creating your Match Fit ${roleLabel} account.`,
    "",
    `Confirm your email: ${args.confirmUrl}`,
    "",
    "This link expires after a while. If you did not sign up, you can ignore this message.",
    "",
    "— Match Fit",
  ].join("\n");

  const s = MF_EMAIL_SITE;
  const bodyHtml = `<p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:${s.textMuted};text-align:center;max-width:480px;margin-left:auto;margin-right:auto;">Hi ${escapeHtmlEmail(firstName)}, confirm your email to finish creating your Match Fit ${escapeHtmlEmail(roleLabel)} account.</p>`;
  const html = wrapMatchFitTransactionalHtml({
    preheader: "Confirm your email to continue Match Fit sign-up.",
    title: "Confirm your email",
    bodyHtml,
    ctaHref: args.confirmUrl,
    ctaLabel: "Confirm email",
  });

  return { subject, text, html };
}

async function findAuthUserByEmail(email: string): Promise<{ emailConfirmed: boolean } | null> {
  const rows = await prisma.$queryRaw<{ email_confirmed_at: Date | null }[]>`
    SELECT "email_confirmed_at"
    FROM auth.users
    WHERE lower(email) = lower(${email})
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) return null;
  return { emailConfirmed: row.email_confirmed_at != null };
}

/**
 * Generates a Supabase email-confirmation link and delivers it through Resend
 * (match-fit.net), bypassing Supabase's default SMTP which often misses inboxes.
 */
export async function sendSupabaseSignupVerificationEmail(args: {
  email: string;
  password?: string | null;
  role: SupabaseSignupVerificationRole;
  firstName?: string;
}): Promise<SendSupabaseSignupVerificationResult> {
  if (!isSupabaseAdminConfigured()) {
    return {
      ok: false,
      code: "SUPABASE_ADMIN_NOT_CONFIGURED",
      error: "Sign-up email delivery is not fully configured. Contact support@match-fit.net.",
    };
  }
  if (!process.env.RESEND_API_KEY?.trim()) {
    return {
      ok: false,
      code: "RESEND_NOT_CONFIGURED",
      error: "Sign-up email delivery is not fully configured. Contact support@match-fit.net.",
    };
  }

  const email = args.email.trim().toLowerCase();
  const redirectTo = getSupabaseEmailCallbackUrl();
  const metadata = {
    match_fit_role: args.role,
    pending_match_fit_profile: true,
  };

  try {
    const existing = await findAuthUserByEmail(email);
    if (existing?.emailConfirmed) {
      return {
        ok: false,
        code: "EMAIL_ALREADY_CONFIRMED",
        error: "This email is already verified. Sign in or continue from your verification link.",
      };
    }

    const admin = createSupabaseAdminClient();
    const password = args.password?.trim();
    const { data, error } = password
      ? await admin.auth.admin.generateLink({
          type: "signup",
          email,
          password,
          options: { redirectTo, data: metadata },
        })
      : await admin.auth.admin.generateLink({
          type: "magiclink",
          email,
          options: { redirectTo, data: metadata },
        });

    if (error) {
      console.error("[sendSupabaseSignupVerificationEmail] generateLink", error);
      return {
        ok: false,
        code: "GENERATE_LINK_FAILED",
        error: "We could not create a verification link. Try again in a moment.",
      };
    }

    const confirmUrl = data?.properties?.action_link?.trim();
    if (!confirmUrl) {
      return {
        ok: false,
        code: "MISSING_CONFIRM_LINK",
        error: "We could not create a verification link. Try again in a moment.",
      };
    }

    const mail = buildVerificationEmail({
      role: args.role,
      firstName: args.firstName,
      confirmUrl,
    });

    const resendId = await sendMatchFitBrandedEmail({
      to: email,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
      replyTo: "support@match-fit.net",
    });

    return { ok: true, resendId };
  } catch (e) {
    console.error("[sendSupabaseSignupVerificationEmail]", e);
    return {
      ok: false,
      code: "SEND_FAILED",
      error: "We could not send the verification email. Please try again in a moment.",
    };
  }
}

/** Public health probe: Resend + Supabase admin ready for signup verification delivery. */
export function supabaseSignupVerificationDeliveryConfigured(): boolean {
  return isSupabaseAdminConfigured() && Boolean(process.env.RESEND_API_KEY?.trim());
}

export function supabaseSignupVerificationHealthMessage(): string {
  if (supabaseSignupVerificationDeliveryConfigured()) {
    return "Trainer/client signup verification emails are delivered via Resend.";
  }
  if (!isSupabaseAdminConfigured()) {
    return "SUPABASE_SERVICE_ROLE_KEY is missing — signup verification relies on Supabase default SMTP only.";
  }
  if (!process.env.RESEND_API_KEY?.trim()) {
    return "RESEND_API_KEY is missing — signup verification relies on Supabase default SMTP only.";
  }
  return "Signup verification email delivery is not fully configured.";
}
