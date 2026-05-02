import { isEmailTaken, isUsernameTaken } from "@/lib/client-queries";
import { deliverSignupOtp } from "@/lib/deliver-otp";
import type { OtpChannel } from "@/lib/deliver-otp";
import { generateSixDigitCode, hashOtp } from "@/lib/otp";
import { hashPassword } from "@/lib/password";
import { purgeExpiredRegistrationHolds } from "@/lib/purge-registration-holds";
import { prisma } from "@/lib/prisma";
import {
  firstZodErrorMessage,
  normalizeRegisterJson,
  registerPending2faSchema,
} from "@/lib/validations/client-register";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";
import { verifyTurnstileToken } from "@/lib/turnstile-verify";
import { NextResponse } from "next/server";

function isAtLeast18(birthYmd: string): boolean {
  const [y, m, d] = birthYmd.split("-").map(Number);
  if (!y || !m || !d) return false;
  const birth = new Date(y, m - 1, d);
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 18);
  return birth <= cutoff;
}

export async function POST(req: Request) {
  try {
    await purgeExpiredRegistrationHolds();

    const json = await req.json();
    const parsed = registerPending2faSchema.safeParse(normalizeRegisterJson(json));
    if (!parsed.success) {
      return NextResponse.json({ error: firstZodErrorMessage(parsed.error) }, { status: 400 });
    }
    const turn = await verifyTurnstileToken(parsed.data.turnstileToken, req);
    if (!turn.ok) {
      return NextResponse.json({ error: turn.error }, { status: turn.status });
    }
    const body = parsed.data;
    if (!isAtLeast18(body.dateOfBirth)) {
      return NextResponse.json({ error: "You must be at least 18 years old." }, { status: 400 });
    }

    const username = body.username.trim();
    const email = body.email.trim().toLowerCase();

    if (await isUsernameTaken(username)) {
      return NextResponse.json({ error: "That username is already taken." }, { status: 409 });
    }
    if (await isEmailTaken(email)) {
      return NextResponse.json({ error: "That email is already registered." }, { status: 409 });
    }

    const passwordHash = await hashPassword(body.password);
    const code = generateSixDigitCode();
    const otpHash = hashOtp(code);
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    const method = body.twoFactorMethod as OtpChannel;

    const pending = await prisma.pendingClientRegistration.create({
      data: {
        firstName: body.firstName,
        lastName: body.lastName,
        preferredName: body.preferredName,
        username,
        phone: body.phone.trim(),
        email,
        passwordHash,
        zipCode: body.zipCode,
        dateOfBirth: body.dateOfBirth,
        termsAcceptedAt: new Date(),
        privacyPolicyAcceptedAt: new Date(),
        status: "PENDING_2FA",
        twoFactorEnabled: true,
        twoFactorMethod: method,
        otpHash,
        otpExpiresAt,
        stayLoggedIn: body.stayLoggedIn,
        expiresAt,
      },
    });

    let deliveryMeta: { devPhoneMock?: boolean } = {};
    try {
      deliveryMeta = await deliverSignupOtp(method, {
        email,
        phone: body.phone.trim(),
        code,
      });
    } catch (deliverErr) {
      console.error("[register pending-2FA] OTP delivery failed; removing pending row.", deliverErr);
      await prisma.pendingClientRegistration.delete({ where: { id: pending.id } });
      throw deliverErr;
    }

    return NextResponse.json({
      ok: true,
      pendingId: pending.id,
      ...(deliveryMeta?.devPhoneMock ? { devPhoneMock: true } : {}),
    });
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Could not start verification. Try again.", {
      logLabel: "[Match Fit register pending-2FA]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
