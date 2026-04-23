import { verifyOtp } from "@/lib/otp";
import { purgeExpiredRegistrationHolds } from "@/lib/purge-registration-holds";
import { prisma } from "@/lib/prisma";
import { completePendingSchema } from "@/lib/validations/client-register";
import { setRegistrationHoldCookie } from "@/lib/session";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";
import { NextResponse } from "next/server";

const HOLD_TTL_MS = 72 * 60 * 60 * 1000;

export async function POST(req: Request) {
  try {
    await purgeExpiredRegistrationHolds();

    const json = await req.json();
    const parsed = completePendingSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid verification request." }, { status: 400 });
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

    await prisma.pendingClientRegistration.update({
      where: { id: pending.id },
      data: {
        status: "AWAITING_PAYMENT",
        otpHash: null,
        otpExpiresAt: null,
        expiresAt: new Date(Date.now() + HOLD_TTL_MS),
      },
    });

    await setRegistrationHoldCookie(pending.id);
    return NextResponse.json({ ok: true, pendingId: pending.id, next: "/client/subscribe" });
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Could not complete verification. Try again.", {
      logLabel: "[Match Fit complete-pending]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
