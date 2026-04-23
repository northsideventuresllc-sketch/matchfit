import { randomBytes } from "crypto";
import { deliverPasswordResetEmail } from "@/lib/deliver-password-reset-email";
import { deliverSignupOtp } from "@/lib/deliver-otp";
import type { OtpChannel } from "@/lib/deliver-otp";
import { getAppOriginFromRequest } from "@/lib/app-origin";
import { generateSixDigitCode, hashOtp } from "@/lib/otp";
import { prisma } from "@/lib/prisma";
import { signPasswordChangeToken } from "@/lib/password-change-jwt";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";
import { getSessionClientId } from "@/lib/session";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const clientId = await getSessionClientId();
    if (!clientId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    await prisma.client.update({
      where: { id: clientId },
      data: {
        passwordChangeNonce: null,
        passwordChangeExpires: null,
        passwordChangeOtpHash: null,
        passwordChangeOtpExpires: null,
      },
    });

    if (client.twoFactorEnabled && client.twoFactorMethod && client.twoFactorMethod !== "NONE") {
      const code = generateSixDigitCode();
      const otpHash = hashOtp(code);
      const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
      await prisma.client.update({
        where: { id: clientId },
        data: {
          passwordChangeOtpHash: otpHash,
          passwordChangeOtpExpires: otpExpiresAt,
        },
      });
      let pwOtpMeta: { devPhoneMock?: boolean } = {};
      try {
        pwOtpMeta = await deliverSignupOtp(client.twoFactorMethod as OtpChannel, {
          email: client.email,
          phone: client.phone,
          code,
        });
      } catch (deliverErr) {
        console.error("[password-change start] OTP delivery failed; clearing password-change OTP.", deliverErr);
        await prisma.client.update({
          where: { id: clientId },
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
    const token = await signPasswordChangeToken(clientId, nonce);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await prisma.client.update({
      where: { id: clientId },
      data: {
        passwordChangeNonce: nonce,
        passwordChangeExpires: expiresAt,
      },
    });

    const origin = getAppOriginFromRequest(req);
    const resetUrl = `${origin}/client/reset-password?token=${encodeURIComponent(token)}`;
    await deliverPasswordResetEmail({ email: client.email, resetUrl });

    return NextResponse.json({ ok: true, flow: "email" as const });
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Could not start password change. Try again.", {
      logLabel: "[Match Fit password-change start]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
