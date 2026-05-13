import { send2FACode } from "@/lib/auth-2fa-email";
import { findTrainerByIdentifier } from "@/lib/trainer-queries";
import { getTrainerLoginOtpDelivery } from "@/lib/trainer-login-two-factor-target";
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

    const otpDelivery = await getTrainerLoginOtpDelivery(trainer.id);
    if (trainer.twoFactorEnabled && otpDelivery) {
      try {
        await send2FACode(otpDelivery.email, trainer.id, "TRAINER");
      } catch (deliverErr) {
        console.error("[Match Fit trainer login 2FA] Email OTP delivery failed.", deliverErr);
        throw deliverErr;
      }
      await prisma.trainer.update({
        where: { id: trainer.id },
        data: {
          stayLoggedIn,
          twoFactorLoginAttempts: 0,
          twoFactorMethod: "EMAIL",
          twoFactorOtpHash: null,
          twoFactorOtpExpires: null,
        },
      });
      const token = await signTrainerLoginChallengeToken(trainer.id, { stayLoggedIn, redirectAfterLogin });
      const res = NextResponse.json({
        needsTwoFactor: true,
        next: "/verify-2fa",
      });
      applyTrainerLoginChallengeToNextResponse(res, token);
      return res;
    }

    await prisma.trainer.update({
      where: { id: trainer.id },
      data: { stayLoggedIn },
    });
    const res = NextResponse.json({ ok: true, next: redirectAfterLogin });
    await applyTrainerSessionToNextResponse(res, trainer.id, stayLoggedIn);
    return res;
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Sign-in failed. Please try again.", {
      logLabel: "[Match Fit trainer login]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
