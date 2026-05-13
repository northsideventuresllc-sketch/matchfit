import { assertEmailResendCooldown, findClientEmailChannel, send2FACode } from "@/lib/auth-2fa-email";
import { getLoginOtpDelivery } from "@/lib/login-two-factor-target";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { LOGIN_CHALLENGE_COOKIE, verifyLoginChallengeToken } from "@/lib/session";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";
import { NextResponse } from "next/server";

/**
 * Issues a new login 2FA code while the login challenge cookie is still valid
 * (e.g. after expiry or after too many wrong attempts invalidated the previous code).
 */
export async function POST() {
  try {
    const store = await cookies();
    const challenge = store.get(LOGIN_CHALLENGE_COOKIE)?.value;
    const challengeResult = challenge ? await verifyLoginChallengeToken(challenge) : null;
    if (!challengeResult) {
      return NextResponse.json({ error: "Verification session expired. Sign in again." }, { status: 401 });
    }
    const { clientId } = challengeResult;

    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const delivery = await getLoginOtpDelivery(clientId);
    if (!client.twoFactorEnabled || !delivery) {
      return NextResponse.json({ error: "Two-factor authentication is not active for this account." }, { status: 400 });
    }

    const row = await findClientEmailChannel(clientId, delivery.email);
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
      await send2FACode(delivery.email, clientId, "CLIENT", { countTowardResendCooldown: true });
    } catch (deliverErr) {
      console.error("[Match Fit resend 2FA] Email delivery failed.", deliverErr);
      throw deliverErr;
    }
    await prisma.client.update({
      where: { id: clientId },
      data: { twoFactorLoginAttempts: 0, twoFactorMethod: "EMAIL" },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Could not resend your code. Please try again.", {
      logLabel: "[Match Fit resend 2FA]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
