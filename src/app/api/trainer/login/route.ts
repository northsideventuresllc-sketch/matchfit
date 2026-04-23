import { findTrainerByIdentifier } from "@/lib/trainer-queries";
import { deliverSignupOtp } from "@/lib/deliver-otp";
import { getTrainerLoginOtpDelivery } from "@/lib/trainer-login-two-factor-target";
import { generateSixDigitCode, hashOtp } from "@/lib/otp";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import {
  applyTrainerLoginChallengeToNextResponse,
  applyTrainerSessionToNextResponse,
  signTrainerLoginChallengeToken,
} from "@/lib/session";
import { normalizeTrainerPostAuthPath } from "@/lib/trainer-post-auth-redirect";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";
import { trainerLoginSchema } from "@/lib/validations/trainer-register";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const parsed = trainerLoginSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid login request." }, { status: 400 });
    }
    const { identifier, password, stayLoggedIn, redirectAfterLogin: redirectRaw } = parsed.data;
    const redirectAfterLogin = normalizeTrainerPostAuthPath(redirectRaw) ?? "/trainer/onboarding";
    const trainer = await findTrainerByIdentifier(identifier);
    if (!trainer) {
      return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
    }
    const ok = await verifyPassword(password, trainer.passwordHash);
    if (!ok) {
      return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
    }

    const otpDelivery = await getTrainerLoginOtpDelivery(trainer.id);
    if (trainer.twoFactorEnabled && otpDelivery) {
      const code = generateSixDigitCode();
      const otpHash = hashOtp(code);
      const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
      const prevStay = trainer.stayLoggedIn;
      const prevAttempts = trainer.twoFactorLoginAttempts ?? 0;

      await prisma.trainer.update({
        where: { id: trainer.id },
        data: {
          twoFactorOtpHash: otpHash,
          twoFactorOtpExpires: otpExpiresAt,
          stayLoggedIn,
          twoFactorLoginAttempts: 0,
          twoFactorMethod: otpDelivery.delivery,
        },
      });
      let otpDeliveryMeta: { devPhoneMock?: boolean } = {};
      try {
        otpDeliveryMeta = await deliverSignupOtp(otpDelivery.delivery, {
          email: otpDelivery.email,
          phone: otpDelivery.phone,
          code,
        });
      } catch (deliverErr) {
        console.error(
          "[Match Fit trainer login 2FA] OTP delivery failed; clearing stored OTP so codes stay consistent.",
          deliverErr,
        );
        await prisma.trainer.update({
          where: { id: trainer.id },
          data: {
            twoFactorOtpHash: null,
            twoFactorOtpExpires: null,
            stayLoggedIn: prevStay,
            twoFactorLoginAttempts: prevAttempts,
          },
        });
        throw deliverErr;
      }
      const token = await signTrainerLoginChallengeToken(trainer.id, { stayLoggedIn, redirectAfterLogin });
      const res = NextResponse.json({
        needsTwoFactor: true,
        next: "/trainer/verify-2fa",
        ...(otpDeliveryMeta?.devPhoneMock ? { devPhoneMock: true } : {}),
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
