import { deliverSignupOtp } from "@/lib/deliver-otp";
import { generateSixDigitCode, hashOtp, verifyOtp } from "@/lib/otp";
import { verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { getSessionClientId } from "@/lib/session";
import { settings2faSchema } from "@/lib/validations/client-register";
import type { OtpChannel } from "@/lib/deliver-otp";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const clientId = await getSessionClientId();
    if (!clientId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const json = await req.json();
    const parsed = settings2faSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }
    const body = parsed.data;

    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    if (body.action === "disable") {
      if (!client.twoFactorEnabled) {
        return NextResponse.json({ error: "Two-factor authentication is already off." }, { status: 400 });
      }
      const ok = await verifyPassword(body.password, client.passwordHash);
      if (!ok) {
        return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
      }
      await prisma.client.update({
        where: { id: clientId },
        data: {
          twoFactorEnabled: false,
          twoFactorMethod: "NONE",
          twoFactorOtpHash: null,
          twoFactorOtpExpires: null,
          twoFactorLoginAttempts: 0,
        },
      });
      return NextResponse.json({ ok: true });
    }

    if (body.action === "request_enable") {
      if (client.twoFactorEnabled) {
        return NextResponse.json({ error: "Two-factor authentication is already on." }, { status: 400 });
      }
      const ok = await verifyPassword(body.password, client.passwordHash);
      if (!ok) {
        return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
      }
      const method = body.method as OtpChannel;
      const code = generateSixDigitCode();
      const otpHash = hashOtp(code);
      const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

      await prisma.client.update({
        where: { id: clientId },
        data: {
          twoFactorMethod: body.method,
          twoFactorOtpHash: otpHash,
          twoFactorOtpExpires: otpExpiresAt,
          twoFactorLoginAttempts: 0,
        },
      });

      await deliverSignupOtp(method, {
        email: client.email,
        phone: client.phone,
        code,
      });

      return NextResponse.json({ ok: true, method });
    }

    if (body.action === "confirm_enable") {
      if (client.twoFactorEnabled) {
        return NextResponse.json({ error: "Two-factor authentication is already on." }, { status: 400 });
      }
      if (!client.twoFactorOtpHash || !client.twoFactorOtpExpires) {
        return NextResponse.json({ error: "Request a verification code first." }, { status: 400 });
      }
      if (client.twoFactorOtpExpires < new Date()) {
        return NextResponse.json({ error: "That code has expired. Request a new one." }, { status: 400 });
      }
      if (!verifyOtp(body.code, client.twoFactorOtpHash)) {
        return NextResponse.json({ error: "Invalid verification code." }, { status: 400 });
      }

      await prisma.client.update({
        where: { id: clientId },
        data: {
          twoFactorEnabled: true,
          twoFactorOtpHash: null,
          twoFactorOtpExpires: null,
          twoFactorLoginAttempts: 0,
        },
      });

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  } catch (e) {
    console.error(e);
    const message = e instanceof Error ? e.message : "Request failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
