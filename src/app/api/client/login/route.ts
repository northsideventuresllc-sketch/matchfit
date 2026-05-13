import { send2FACode } from "@/lib/auth-2fa-email";
import { findClientByIdentifier } from "@/lib/client-queries";
import { getLoginOtpDelivery } from "@/lib/login-two-factor-target";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import {
  setClientSession,
  setLoginChallengeCookie,
  signLoginChallengeToken,
} from "@/lib/session";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";
import { verifyTurnstileToken } from "@/lib/turnstile-verify";
import { loginSchema } from "@/lib/validations/client-register";
import { NextResponse } from "next/server";

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

    const otpDelivery = await getLoginOtpDelivery(client.id);
    if (client.twoFactorEnabled && otpDelivery) {
      try {
        await send2FACode(otpDelivery.email, client.id, "CLIENT");
      } catch (deliverErr) {
        console.error("[Match Fit login 2FA] Email OTP delivery failed.", deliverErr);
        throw deliverErr;
      }
      await prisma.client.update({
        where: { id: client.id },
        data: {
          stayLoggedIn,
          twoFactorLoginAttempts: 0,
          twoFactorMethod: "EMAIL",
          twoFactorOtpHash: null,
          twoFactorOtpExpires: null,
        },
      });
      const token = await signLoginChallengeToken(client.id, { stayLoggedIn });
      await setLoginChallengeCookie(token);
      return NextResponse.json({
        needsTwoFactor: true,
        next: "/verify-2fa",
      });
    }

    await prisma.client.update({
      where: { id: client.id },
      data: { stayLoggedIn },
    });
    await setClientSession(client.id, stayLoggedIn);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Sign-in failed. Please try again.", {
      logLabel: "[Match Fit login]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
