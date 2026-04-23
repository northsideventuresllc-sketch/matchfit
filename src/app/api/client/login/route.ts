import { findClientByIdentifier } from "@/lib/client-queries";
import { deliverSignupOtp } from "@/lib/deliver-otp";
import type { OtpChannel } from "@/lib/deliver-otp";
import { generateSixDigitCode, hashOtp } from "@/lib/otp";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import {
  setClientSession,
  setLoginChallengeCookie,
  signLoginChallengeToken,
} from "@/lib/session";
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

    if (client.twoFactorEnabled && client.twoFactorMethod && client.twoFactorMethod !== "NONE") {
      const code = generateSixDigitCode();
      const otpHash = hashOtp(code);
      const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
      await prisma.client.update({
        where: { id: client.id },
        data: {
          twoFactorOtpHash: otpHash,
          twoFactorOtpExpires: otpExpiresAt,
          stayLoggedIn,
          twoFactorLoginAttempts: 0,
        },
      });
      await deliverSignupOtp(client.twoFactorMethod as OtpChannel, {
        email: client.email,
        phone: client.phone,
        code,
      });
      const token = await signLoginChallengeToken(client.id, { stayLoggedIn });
      await setLoginChallengeCookie(token);
      return NextResponse.json({
        needsTwoFactor: true,
        next: "/client/verify-2fa",
      });
    }

    await prisma.client.update({
      where: { id: client.id },
      data: { stayLoggedIn },
    });
    await setClientSession(client.id, stayLoggedIn);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    const message = e instanceof Error ? e.message : "Login failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
