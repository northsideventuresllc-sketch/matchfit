import { clientLoginDeletionRedirect } from "@/lib/account-deletion-login-redirect";
import { isClientAccountLoginBlocked } from "@/lib/client-billing-access";
import { syncClientPlatformBillingLifecycle } from "@/lib/client-platform-lifecycle";
import { send2FACode } from "@/lib/auth-2fa-email";
import { hydratePlatformEnvFromDatabase } from "@/lib/hydrate-platform-env";
import { findClientByIdentifier } from "@/lib/client-queries";
import { getLoginOtpDelivery } from "@/lib/login-two-factor-target";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import {
  applyClientSessionToNextResponse,
  applyLoginChallengeToNextResponse,
  signLoginChallengeToken,
} from "@/lib/session";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";
import { verifyTurnstileToken } from "@/lib/turnstile-verify";
import { loginSchema } from "@/lib/validations/client-register";
import { NextResponse } from "next/server";

function accountDeactivatedResponse() {
  return NextResponse.json(
    {
      error:
        "Your Match Fit account is deactivated because payment was not completed after your free trial. Pay to reactivate your account.",
      code: "ACCOUNT_DEACTIVATED",
      next: "/client/reactivate",
    },
    { status: 403 },
  );
}

function accountSuspendedResponse() {
  return NextResponse.json(
    {
      error:
        "Your client account is suspended pending a Match Fit safety review. You will regain access once the review is complete.",
      code: "ACCOUNT_SUSPENDED",
    },
    { status: 403 },
  );
}

export async function POST(req: Request) {
  try {
    const parsed = loginSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid login request." }, { status: 400 });
    }
    const turn = await verifyTurnstileToken(parsed.data.turnstileToken, req);
    if (!turn.ok) {
      return NextResponse.json({ error: turn.error }, { status: turn.status });
    }
    const { identifier, password, stayLoggedIn } = parsed.data;
    await hydratePlatformEnvFromDatabase();
    const client = await findClientByIdentifier(identifier);
    if (!client) {
      return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
    }
    const ok = await verifyPassword(password, client.passwordHash);
    if (!ok) {
      return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
    }
    if (client.safetySuspended) {
      return accountSuspendedResponse();
    }

    await syncClientPlatformBillingLifecycle(client.id);
    const refreshed = await findClientByIdentifier(identifier);
    if (!refreshed) {
      return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
    }
    if (
      isClientAccountLoginBlocked({
        stripeSubscriptionId: refreshed.stripeSubscriptionId,
        stripeSubscriptionActive: refreshed.stripeSubscriptionActive,
        subscriptionGraceUntil: refreshed.subscriptionGraceUntil,
        platformTrialEndsAt: refreshed.platformTrialEndsAt,
        paymentGraceUntil: refreshed.paymentGraceUntil,
        accountDeactivatedAt: refreshed.accountDeactivatedAt,
        platformTrialConsumed: refreshed.platformTrialConsumed,
      })
    ) {
      return accountDeactivatedResponse();
    }

    const otpDelivery = await getLoginOtpDelivery(refreshed.id);
    if (refreshed.twoFactorEnabled && otpDelivery) {
      try {
        await send2FACode(otpDelivery.email, refreshed.id, "CLIENT");
      } catch (deliverErr) {
        console.error("[Match Fit login 2FA] Email OTP delivery failed.", deliverErr);
        throw deliverErr;
      }
      await prisma.client.update({
        where: { id: refreshed.id },
        data: {
          stayLoggedIn,
          twoFactorLoginAttempts: 0,
          twoFactorMethod: "EMAIL",
          twoFactorOtpHash: null,
          twoFactorOtpExpires: null,
        },
      });
      const token = await signLoginChallengeToken(refreshed.id, { stayLoggedIn });
      const res = NextResponse.json({
        needsTwoFactor: true,
        next: "/verify-2fa",
      });
      applyLoginChallengeToNextResponse(res, token);
      return res;
    }

    await prisma.client.update({
      where: { id: refreshed.id },
      data: { stayLoggedIn },
    });
    const deletionRedirect = await clientLoginDeletionRedirect(refreshed.id);
    const res = NextResponse.json(
      deletionRedirect ? { ok: true, ...deletionRedirect } : { ok: true },
    );
    await applyClientSessionToNextResponse(res, refreshed.id, stayLoggedIn);
    return res;
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Sign-in failed. Please try again.", {
      logLabel: "[Match Fit login]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
