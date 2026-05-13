import { assertEmailResendCooldown, findTrainerEmailChannel, send2FACode } from "@/lib/auth-2fa-email";
import { getTrainerLoginOtpDelivery } from "@/lib/trainer-login-two-factor-target";
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

    const row = await findTrainerEmailChannel(trainerId, delivery.email);
    if (row) {
      const cool = await assertEmailResendCooldown(row.lastEmailResendAt);
      if (!cool.ok) {
        return NextResponse.json(
          { error: `Please wait ${cool.waitSeconds}s before requesting another code.` },
          { status: 429 },
        );
      }
    }
    try {
      await send2FACode(delivery.email, trainerId, "TRAINER", { countTowardResendCooldown: true });
    } catch (deliverErr) {
      console.error("[Match Fit trainer resend 2FA] Email delivery failed.", deliverErr);
      throw deliverErr;
    }
    await prisma.trainer.update({
      where: { id: trainerId },
      data: { twoFactorLoginAttempts: 0, twoFactorMethod: "EMAIL" },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Could not resend your code. Please try again.", {
      logLabel: "[Match Fit trainer resend 2FA]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
