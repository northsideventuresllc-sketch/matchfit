import { findClientByIdentifier } from "@/lib/client-queries";
import { deliverSignupOtp } from "@/lib/deliver-otp";
import { getLoginOtpDelivery } from "@/lib/login-two-factor-target";
import { generateSixDigitCode, hashOtp } from "@/lib/otp";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import {
  setClientSession,
  setLoginChallengeCookie,
  signLoginChallengeToken,
} from "@/lib/session";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";
import { loginSchema } from "@/lib/validations/client-register";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const parsed = loginSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid login request." }, { status: 400 });
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

    const otpDelivery = await getLoginOtpDelivery(client.id);
    if (client.twoFactorEnabled && otpDelivery) {
      const code = generateSixDigitCode();
      const otpHash = hashOtp(code);
      const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
      const prevStay = client.stayLoggedIn;
      const prevAttempts = client.twoFactorLoginAttempts ?? 0;

      await prisma.client.update({
        where: { id: client.id },
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
        console.error("[Match Fit login 2FA] OTP delivery failed; clearing stored OTP so codes stay consistent.", deliverErr);
        await prisma.client.update({
          where: { id: client.id },
          data: {
            twoFactorOtpHash: null,
            twoFactorOtpExpires: null,
            stayLoggedIn: prevStay,
            twoFactorLoginAttempts: prevAttempts,
          },
        });
        throw deliverErr;
      }
      const token = await signLoginChallengeToken(client.id, { stayLoggedIn });
      await setLoginChallengeCookie(token);
      return NextResponse.json({
        needsTwoFactor: true,
        next: "/client/verify-2fa",
        ...(otpDeliveryMeta?.devPhoneMock ? { devPhoneMock: true } : {}),
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
