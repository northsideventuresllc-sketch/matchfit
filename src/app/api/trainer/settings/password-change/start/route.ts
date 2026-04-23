import { randomBytes } from "crypto";
import { deliverPasswordResetEmail } from "@/lib/deliver-password-reset-email";
import { deliverSignupOtp } from "@/lib/deliver-otp";
import type { OtpChannel } from "@/lib/deliver-otp";
import { getAppOriginFromRequest } from "@/lib/app-origin";
import { generateSixDigitCode, hashOtp } from "@/lib/otp";
import { prisma } from "@/lib/prisma";
import { signPasswordChangeToken } from "@/lib/password-change-jwt";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";
import { getSessionTrainerId } from "@/lib/session";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const trainer = await prisma.trainer.findUnique({ where: { id: trainerId } });
    if (!trainer) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    await prisma.trainer.update({
      where: { id: trainerId },
      data: {
        passwordChangeNonce: null,
        passwordChangeExpires: null,
        passwordChangeOtpHash: null,
        passwordChangeOtpExpires: null,
      },
    });

    if (trainer.twoFactorEnabled && trainer.twoFactorMethod && trainer.twoFactorMethod !== "NONE") {
      const code = generateSixDigitCode();
      const otpHash = hashOtp(code);
      const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
      await prisma.trainer.update({
        where: { id: trainerId },
        data: {
          passwordChangeOtpHash: otpHash,
          passwordChangeOtpExpires: otpExpiresAt,
        },
      });
      let pwOtpMeta: { devPhoneMock?: boolean } = {};
      try {
        pwOtpMeta = await deliverSignupOtp(trainer.twoFactorMethod as OtpChannel, {
          email: trainer.email,
          phone: trainer.phone,
          code,
        });
      } catch (deliverErr) {
        console.error("[trainer password-change start] OTP delivery failed; clearing password-change OTP.", deliverErr);
        await prisma.trainer.update({
          where: { id: trainerId },
          data: {
            passwordChangeOtpHash: null,
            passwordChangeOtpExpires: null,
          },
        });
        throw deliverErr;
      }
      return NextResponse.json({
        ok: true,
        flow: "otp" as const,
        ...(pwOtpMeta?.devPhoneMock ? { devPhoneMock: true } : {}),
      });
    }

    const nonce = randomBytes(24).toString("hex");
    const token = await signPasswordChangeToken(trainerId, nonce);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await prisma.trainer.update({
      where: { id: trainerId },
      data: {
        passwordChangeNonce: nonce,
        passwordChangeExpires: expiresAt,
      },
    });

    const origin = getAppOriginFromRequest(req);
    const resetUrl = `${origin}/trainer/reset-password?token=${encodeURIComponent(token)}`;
    await deliverPasswordResetEmail({ email: trainer.email, resetUrl });

    return NextResponse.json({ ok: true, flow: "email" as const });
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Could not start password change. Try again.", {
      logLabel: "[Match Fit trainer password-change start]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
