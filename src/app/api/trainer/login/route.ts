import { trainerLoginDeletionRedirect } from "@/lib/account-deletion-login-redirect";
import { send2FACode } from "@/lib/auth-2fa-email";
import { findTrainerByIdentifier } from "@/lib/trainer-queries";
import { getTrainerLoginOtpDelivery } from "@/lib/trainer-login-two-factor-target";
import { isTrainerAccountLoginBlocked, trainerNeedsPaymentSetup } from "@/lib/trainer-platform-access";
import { syncTrainerPlatformBillingLifecycle } from "@/lib/trainer-platform-lifecycle";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import {
  applyTrainerLoginChallengeToNextResponse,
  applyTrainerSessionToNextResponse,
  signTrainerLoginChallengeToken,
} from "@/lib/session";
import { normalizeTrainerPostAuthPath } from "@/lib/trainer-post-auth-redirect";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";
import { verifyTurnstileToken } from "@/lib/turnstile-verify";
import { trainerLoginSchema } from "@/lib/validations/trainer-register";
import { NextResponse } from "next/server";

function accountDeactivatedResponse() {
  return NextResponse.json(
    {
      error:
        "Your Match Fit Independent Pro account is deactivated because payment was not completed after your free trial. Pay to reactivate your account.",
      code: "ACCOUNT_DEACTIVATED",
      next: "/trainer/reactivate",
    },
    { status: 403 },
  );
}

export async function POST(req: Request) {
  try {
    const parsed = trainerLoginSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid login request." }, { status: 400 });
    }
    const turn = await verifyTurnstileToken(parsed.data.turnstileToken, req);
    if (!turn.ok) {
      return NextResponse.json({ error: turn.error }, { status: turn.status });
    }
    const { identifier, password, stayLoggedIn, redirectAfterLogin: redirectRaw } = parsed.data;
    const redirectAfterLogin = normalizeTrainerPostAuthPath(redirectRaw) ?? "/trainer/dashboard";
    const trainer = await findTrainerByIdentifier(identifier);
    if (!trainer) {
      return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
    }
    const ok = await verifyPassword(password, trainer.passwordHash);
    if (!ok) {
      return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
    }

    if (trainer.safetySuspended) {
      return NextResponse.json(
        {
          error:
            "Your trainer account is suspended pending a Match Fit safety review. You will regain access once the review is complete.",
          code: "ACCOUNT_SUSPENDED",
        },
        { status: 403 },
      );
    }

    if (trainer.securityLockedAt) {
      return NextResponse.json(
        {
          error: "Your account is locked for security. Contact support to get it unlocked.",
          code: "ACCOUNT_SECURITY_LOCKED",
        },
        { status: 403 },
      );
    }

    await syncTrainerPlatformBillingLifecycle(trainer.id);
    const refreshed = await findTrainerByIdentifier(identifier);
    if (!refreshed) {
      return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
    }

    const billingFields = {
      stripeSubscriptionId: refreshed.stripeSubscriptionId,
      stripeSubscriptionActive: refreshed.stripeSubscriptionActive,
      subscriptionGraceUntil: refreshed.subscriptionGraceUntil,
      platformTrialEndsAt: refreshed.platformTrialEndsAt,
      paymentGraceUntil: refreshed.paymentGraceUntil,
      accountDeactivatedAt: refreshed.accountDeactivatedAt,
      platformTrialConsumed: refreshed.platformTrialConsumed,
    };

    if (isTrainerAccountLoginBlocked(billingFields)) {
      return accountDeactivatedResponse();
    }

    const paymentRequired = trainerNeedsPaymentSetup(billingFields);
    const postAuthNext = paymentRequired
      ? "/trainer/dashboard/billing?locked=1"
      : redirectAfterLogin;

    const otpDelivery = await getTrainerLoginOtpDelivery(refreshed.id);
    if (refreshed.twoFactorEnabled && otpDelivery) {
      try {
        await send2FACode(otpDelivery.email, refreshed.id, "TRAINER");
      } catch (deliverErr) {
        console.error("[Match Fit trainer login 2FA] Email OTP delivery failed.", deliverErr);
        throw deliverErr;
      }
      await prisma.trainer.update({
        where: { id: refreshed.id },
        data: {
          stayLoggedIn,
          twoFactorLoginAttempts: 0,
          twoFactorMethod: "EMAIL",
          twoFactorOtpHash: null,
          twoFactorOtpExpires: null,
        },
      });
      const token = await signTrainerLoginChallengeToken(refreshed.id, {
        stayLoggedIn,
        redirectAfterLogin: postAuthNext,
      });
      const res = NextResponse.json({
        needsTwoFactor: true,
        next: "/verify-2fa",
        ...(paymentRequired
          ? {
              code: "PAYMENT_REQUIRED",
              message:
                "Your Independent Pro free trial has ended. Enter payment info to keep your account active at $15.00 per month.",
            }
          : {}),
      });
      applyTrainerLoginChallengeToNextResponse(res, token);
      return res;
    }

    await prisma.trainer.update({
      where: { id: refreshed.id },
      data: { stayLoggedIn },
    });
    const deletionRedirect = await trainerLoginDeletionRedirect(refreshed.id);
    const res = NextResponse.json({
      ok: true,
      next: deletionRedirect?.next ?? postAuthNext,
      ...(deletionRedirect ? { finalizeAt: deletionRedirect.finalizeAt } : {}),
      ...(paymentRequired
        ? {
            code: "PAYMENT_REQUIRED",
            message:
              "Your Independent Pro free trial has ended. Enter payment info to keep your account active at $15.00 per month.",
          }
        : {}),
    });
    await applyTrainerSessionToNextResponse(res, refreshed.id, stayLoggedIn);
    return res;
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Sign-in failed. Please try again.", {
      logLabel: "[Match Fit trainer login]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
