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
  | { ok: false; error: string; code: string; retryAfterSeconds?: number };

type EnsureSupabaseAuthSignupUserResult =
  | { ok: true; userId: string }
  | { ok: false; error: string; code: string; retryAfterSeconds?: number };

const RESEND_COOLDOWN_MS = 2 * 60 * 1000;

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

type AuthUserRow = {
  id: string;
  email_confirmed_at: Date | null;
  raw_user_meta_data: Record<string, unknown> | null;
};

async function findAuthUserByEmail(email: string): Promise<AuthUserRow | null> {
  const rows = await prisma.$queryRaw<AuthUserRow[]>`
    SELECT id, "email_confirmed_at", raw_user_meta_data
    FROM auth.users
    WHERE lower(email) = lower(${email})
    LIMIT 1
  `;
  return rows[0] ?? null;
}

function mapSupabaseAuthError(error: { message?: string; status?: number }): EnsureSupabaseAuthSignupUserResult {
  const msg = (error.message ?? "").toLowerCase();
  if (
    error.status === 429 ||
    msg.includes("rate limit") ||
    msg.includes("email rate") ||
    msg.includes("over_email_send_rate_limit")
  ) {
    return {
      ok: false,
      code: "EMAIL_RATE_LIMIT",
      error:
        "Too many verification emails were requested recently. Wait about an hour, then tap Resend—or use “Continue with password” if you already confirmed your email.",
      retryAfterSeconds: 3600,
    };
  }
  return {
    ok: false,
    code: "GENERATE_LINK_FAILED",
    error: error.message?.trim() || "We could not create a verification link. Try again in a moment.",
  };
}

function lastVerificationSentAt(meta: Record<string, unknown> | null | undefined): number | null {
  const raw = meta?.last_verification_email_sent_at;
  if (typeof raw !== "string" && typeof raw !== "number") return null;
  const ts = typeof raw === "number" ? raw : Date.parse(raw);
  return Number.isFinite(ts) ? ts : null;
}

async function ensureSupabaseAuthSignupUser(args: {
  email: string;
  password: string;
  role: SupabaseSignupVerificationRole;
}): Promise<EnsureSupabaseAuthSignupUserResult> {
  const admin = createSupabaseAdminClient();
  const email = args.email.trim().toLowerCase();
  const password = args.password.trim();
  const metadata = {
    match_fit_role: args.role,
    pending_match_fit_profile: true,
  };

  const existing = await findAuthUserByEmail(email);
  if (existing?.email_confirmed_at) {
    return {
      ok: false,
      code: "EMAIL_ALREADY_CONFIRMED",
      error: "This email is already verified. Use Continue with password below, or sign in.",
    };
  }

  if (!existing) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
      user_metadata: metadata,
    });
    if (error) {
      console.error("[ensureSupabaseAuthSignupUser] createUser", error);
      return mapSupabaseAuthError(error);
    }
    const userId = data.user?.id;
    if (!userId) {
      return {
        ok: false,
        code: "CREATE_USER_FAILED",
        error: "Could not create your sign-up session. Try again in a moment.",
      };
    }
    return { ok: true, userId };
  }

  const { error } = await admin.auth.admin.updateUserById(existing.id, {
    password,
    user_metadata: {
      ...(existing.raw_user_meta_data ?? {}),
      ...metadata,
    },
  });
  if (error) {
    console.error("[ensureSupabaseAuthSignupUser] updateUserById", error);
    return mapSupabaseAuthError(error);
  }
  return { ok: true, userId: existing.id };
}

/**
 * Creates/updates the Supabase Auth user without Supabase SMTP, generates a magic
 * confirmation link, and delivers it through Resend (match-fit.net).
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
  const password = args.password?.trim();
  if (!password) {
    return {
      ok: false,
      code: "PASSWORD_REQUIRED",
      error: "Enter your password on the form, then try Resend again.",
    };
  }

  const redirectTo = getSupabaseEmailCallbackUrl();
  const metadata = {
    match_fit_role: args.role,
    pending_match_fit_profile: true,
  };

  try {
    const existing = await findAuthUserByEmail(email);
    const lastSent = lastVerificationSentAt(existing?.raw_user_meta_data);
    if (lastSent != null && Date.now() - lastSent < RESEND_COOLDOWN_MS) {
      const retryAfterSeconds = Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - lastSent)) / 1000);
      return {
        ok: false,
        code: "RESEND_COOLDOWN",
        error: `Please wait ${retryAfterSeconds} seconds before requesting another verification email.`,
        retryAfterSeconds,
      };
    }

    const ensured = await ensureSupabaseAuthSignupUser({ email, password, role: args.role });
    if (!("userId" in ensured)) return ensured;
    const userId = ensured.userId;

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo, data: metadata },
    });

    if (error) {
      console.error("[sendSupabaseSignupVerificationEmail] generateLink", error);
      return mapSupabaseAuthError(error);
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

    await admin.auth.admin.updateUserById(userId, {
      user_metadata: {
        ...(existing?.raw_user_meta_data ?? {}),
        ...metadata,
        last_verification_email_sent_at: new Date().toISOString(),
      },
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
    return "Trainer/client signup verification emails are delivered via Resend (Supabase SMTP is not used).";
  }
  if (!isSupabaseAdminConfigured()) {
    return "SUPABASE_SERVICE_ROLE_KEY is missing — signup verification relies on Supabase default SMTP only.";
  }
  if (!process.env.RESEND_API_KEY?.trim()) {
    return "RESEND_API_KEY is missing — signup verification relies on Supabase default SMTP only.";
  }
  return "Signup verification email delivery is not fully configured.";
}
