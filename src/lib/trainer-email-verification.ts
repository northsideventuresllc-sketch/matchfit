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
import { prisma } from "@/lib/prisma";

/**
 * Email confirmation for a Fitness Pro who is already signed in.
 *
 * Sign-up sends people straight to the agreement page and creates the account before the
 * address is proven (JB, 2026-08-04), so confirmation happens on the dashboard instead of a
 * check-your-inbox screen. Unlike the sign-up sender this never needs the plaintext password —
 * the session already establishes who is asking.
 */

const RESEND_COOLDOWN_MS = 2 * 60 * 1000;

export type TrainerVerificationEmailResult =
  | { ok: true; alreadyVerified: boolean }
  | { ok: false; error: string; code: string; retryAfterSeconds?: number };

/** Records that an address has been proven. Idempotent — first confirmation wins. */
export async function markTrainerEmailVerified(email: string): Promise<void> {
  const norm = email.trim().toLowerCase();
  if (!norm) return;
  await prisma.trainer
    .updateMany({ where: { email: norm, emailVerifiedAt: null }, data: { emailVerifiedAt: new Date() } })
    .catch((err) => console.error("[markTrainerEmailVerified]", err));
}

function lastVerificationSentAt(meta: Record<string, unknown> | null | undefined): number | null {
  const raw = meta?.last_verification_email_sent_at;
  if (typeof raw !== "string" && typeof raw !== "number") return null;
  const ts = typeof raw === "number" ? raw : Date.parse(raw);
  return Number.isFinite(ts) ? ts : null;
}

function buildDashboardVerificationEmail(args: {
  firstName?: string | null;
  confirmUrl: string;
}): { subject: string; text: string; html: string } {
  const firstName = args.firstName?.trim() || "Coach";
  const subject = formatTransactionalEmailSubject("Confirm your Match Fit email");
  const text = [
    `Hi ${firstName},`,
    "",
    "Confirm your email address to unlock everything on your Match Fit account.",
    "",
    `Confirm your email: ${args.confirmUrl}`,
    "",
    "This link expires after a while. If you did not request this, you can ignore this message.",
    "",
    "— Match Fit",
  ].join("\n");

  const s = MF_EMAIL_SITE;
  const bodyHtml = `<p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:${s.textMuted};text-align:center;max-width:480px;margin-left:auto;margin-right:auto;">Hi ${escapeHtmlEmail(firstName)}, confirm your email address to unlock everything on your Match Fit account.</p>`;
  const html = wrapMatchFitTransactionalHtml({
    preheader: "Confirm your email address to finish setting up Match Fit.",
    title: "Confirm your email",
    bodyHtml,
    ctaHref: args.confirmUrl,
    ctaLabel: "Confirm email",
  });

  return { subject, text, html };
}

/**
 * Sends a fresh confirmation link to a signed-in Fitness Pro. Resolves the address from the
 * trainer row, never from the request, so a session can only ever verify its own email.
 */
export async function sendTrainerDashboardVerificationEmail(
  trainerId: string,
): Promise<TrainerVerificationEmailResult> {
  if (!isSupabaseAdminConfigured() || !process.env.RESEND_API_KEY?.trim()) {
    return {
      ok: false,
      code: "DELIVERY_NOT_CONFIGURED",
      error: "We cannot send confirmation emails right now. Contact support@match-fit.net.",
    };
  }

  const trainer = await prisma.trainer.findUnique({
    where: { id: trainerId },
    select: { email: true, firstName: true, emailVerifiedAt: true },
  });
  if (!trainer) {
    return { ok: false, code: "TRAINER_NOT_FOUND", error: "We could not find your account." };
  }
  if (trainer.emailVerifiedAt) {
    return { ok: true, alreadyVerified: true };
  }

  const email = trainer.email.trim().toLowerCase();

  try {
    const authUser = await findSupabaseAuthUserByEmail(email);

    // They may have confirmed on another device since this page loaded.
    if (authUser?.email_confirmed_at) {
      await markTrainerEmailVerified(email);
      return { ok: true, alreadyVerified: true };
    }

    const lastSent = lastVerificationSentAt(authUser?.raw_user_meta_data);
    if (lastSent != null && Date.now() - lastSent < RESEND_COOLDOWN_MS) {
      const retryAfterSeconds = Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - lastSent)) / 1000);
      return {
        ok: false,
        code: "RESEND_COOLDOWN",
        error: `Please wait ${retryAfterSeconds} seconds before requesting another email.`,
        retryAfterSeconds,
      };
    }

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: {
        redirectTo: getSupabaseEmailCallbackUrl(),
        data: { match_fit_role: "trainer", pending_match_fit_profile: false },
      },
    });

    if (error) {
      console.error("[sendTrainerDashboardVerificationEmail] generateLink", error);
      const msg = (error.message ?? "").toLowerCase();
      if (error.status === 429 || msg.includes("rate limit") || msg.includes("email rate")) {
        return {
          ok: false,
          code: "EMAIL_RATE_LIMIT",
          error: "Too many emails were requested recently. Try again in about an hour.",
          retryAfterSeconds: 3600,
        };
      }
      return {
        ok: false,
        code: "GENERATE_LINK_FAILED",
        error: "We could not create a confirmation link. Try again in a moment.",
      };
    }

    const confirmUrl = data?.properties?.action_link?.trim();
    if (!confirmUrl) {
      return {
        ok: false,
        code: "MISSING_CONFIRM_LINK",
        error: "We could not create a confirmation link. Try again in a moment.",
      };
    }

    const mail = buildDashboardVerificationEmail({ firstName: trainer.firstName, confirmUrl });
    await sendMatchFitBrandedEmail({
      to: email,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
      replyTo: "support@match-fit.net",
    });

    if (authUser) {
      await admin.auth.admin.updateUserById(authUser.id, {
        user_metadata: {
          ...(authUser.raw_user_meta_data ?? {}),
          match_fit_role: "trainer",
          pending_match_fit_profile: false,
          last_verification_email_sent_at: new Date().toISOString(),
        },
      });
    }

    return { ok: true, alreadyVerified: false };
  } catch (e) {
    console.error("[sendTrainerDashboardVerificationEmail]", e);
    return {
      ok: false,
      code: "SEND_FAILED",
      error: "We could not send the confirmation email. Please try again in a moment.",
    };
  }
}
