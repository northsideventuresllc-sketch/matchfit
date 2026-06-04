import { verifyOtp } from "@/lib/otp";
import { purgeExpiredRegistrationHolds } from "@/lib/purge-registration-holds";
import { prisma } from "@/lib/prisma";
import { completePendingSchema } from "@/lib/validations/client-register";
import { applyClientSessionToNextResponse } from "@/lib/session";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";
import { verifyTurnstileToken } from "@/lib/turnstile-verify";
import { finalizeClientRegistrationFromSignup } from "@/lib/client-register-finalize";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    await purgeExpiredRegistrationHolds();

    const json = await req.json();
    const parsed = completePendingSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid verification request." }, { status: 400 });
    }
    const turn = await verifyTurnstileToken(parsed.data.turnstileToken, req);
    if (!turn.ok) {
      return NextResponse.json({ error: turn.error }, { status: turn.status });
    }
    const { pendingId, code } = parsed.data;

    const pending = await prisma.pendingClientRegistration.findUnique({
      where: { id: pendingId },
    });
    if (!pending || pending.expiresAt < new Date()) {
      return NextResponse.json({ error: "This sign-up session has expired. Start again." }, { status: 410 });
    }
    if (pending.status !== "PENDING_2FA") {
      return NextResponse.json({ error: "This session is not awaiting a verification code." }, { status: 400 });
    }
    if (!pending.otpExpiresAt || !pending.otpHash) {
      return NextResponse.json({ error: "Invalid verification state." }, { status: 400 });
    }
    if (pending.otpExpiresAt < new Date()) {
      return NextResponse.json({ error: "That code has expired. Request a new code." }, { status: 400 });
    }
    if (!verifyOtp(code, pending.otpHash)) {
      return NextResponse.json({ error: "Invalid verification code." }, { status: 400 });
    }

    const result = await finalizeClientRegistrationFromSignup(
      {
        firstName: pending.firstName,
        lastName: pending.lastName,
        preferredName: pending.preferredName,
        username: pending.username,
        phone: pending.phone,
        email: pending.email,
        password: "",
        zipCode: pending.zipCode,
        dateOfBirth: pending.dateOfBirth,
        stayLoggedIn: pending.stayLoggedIn,
      },
      {
        betaClientWaitlistEntryId: pending.betaClientWaitlistEntryId,
        twoFactorEnabled: true,
        twoFactorMethod: pending.twoFactorMethod === "EMAIL" ? "EMAIL" : "NONE",
        passwordHash: pending.passwordHash,
      },
    );

    if (!result.ok) {
      return NextResponse.json({ error: result.error, code: result.code }, { status: 400 });
    }

    await prisma.pendingClientRegistration.deleteMany({ where: { id: pending.id } });

    const res = NextResponse.json({
      ok: true,
      clientId: result.clientId,
      next: "/client/dashboard/preferences/onboarding",
    });
    await applyClientSessionToNextResponse(res, result.clientId, pending.stayLoggedIn);
    return res;
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Could not complete verification. Try again.", {
      logLabel: "[Match Fit complete-pending]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
