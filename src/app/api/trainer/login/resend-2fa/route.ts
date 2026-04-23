import { deliverSignupOtp } from "@/lib/deliver-otp";
import { getTrainerLoginOtpDelivery } from "@/lib/trainer-login-two-factor-target";
import { generateSixDigitCode, hashOtp } from "@/lib/otp";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { TRAINER_LOGIN_CHALLENGE_COOKIE, verifyTrainerLoginChallengeToken } from "@/lib/session";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    const store = await cookies();
    const challenge = store.get(TRAINER_LOGIN_CHALLENGE_COOKIE)?.value;
    const challengeResult = challenge ? await verifyTrainerLoginChallengeToken(challenge) : null;
    if (!challengeResult) {
      return NextResponse.json({ error: "Verification session expired. Sign in again." }, { status: 401 });
    }
    const { trainerId } = challengeResult;

    const trainer = await prisma.trainer.findUnique({ where: { id: trainerId } });
    if (!trainer) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const delivery = await getTrainerLoginOtpDelivery(trainerId);
    if (!trainer.twoFactorEnabled || !delivery) {
      return NextResponse.json({ error: "Two-factor authentication is not active for this account." }, { status: 400 });
    }

    const code = generateSixDigitCode();
    const otpHash = hashOtp(code);
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.trainer.update({
      where: { id: trainerId },
      data: {
        twoFactorOtpHash: otpHash,
        twoFactorOtpExpires: otpExpiresAt,
        twoFactorLoginAttempts: 0,
      },
    });

    let deliveryMeta: { devPhoneMock?: boolean } = {};
    try {
      deliveryMeta = await deliverSignupOtp(delivery.delivery, {
        email: delivery.email,
        phone: delivery.phone,
        code,
      });
    } catch (deliverErr) {
      console.error("[Match Fit trainer resend 2FA] OTP delivery failed; clearing stored OTP.", deliverErr);
      await prisma.trainer.update({
        where: { id: trainerId },
        data: {
          twoFactorOtpHash: null,
          twoFactorOtpExpires: null,
          twoFactorLoginAttempts: 0,
        },
      });
      throw deliverErr;
    }

    return NextResponse.json({ ok: true, ...(deliveryMeta?.devPhoneMock ? { devPhoneMock: true } : {}) });
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Could not resend your code. Please try again.", {
      logLabel: "[Match Fit trainer resend 2FA]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
