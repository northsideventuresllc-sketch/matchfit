import { verifyOtp } from "@/lib/otp";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import {
  clearLoginChallengeCookie,
  LOGIN_CHALLENGE_COOKIE,
  setClientSession,
  verifyLoginChallengeToken,
} from "@/lib/session";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";
import { safeInternalNextPath } from "@/lib/safe-internal-next-path";
import { verifyTurnstileToken } from "@/lib/turnstile-verify";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  code: z.string().regex(/^\d{6}$/),
  next: z.string().optional(),
  turnstileToken: z.string().optional(),
});

const MAX_ATTEMPTS = 3;

export async function POST(req: Request) {
  try {
    const store = await cookies();
    const challenge = store.get(LOGIN_CHALLENGE_COOKIE)?.value;
    const challengeResult = challenge ? await verifyLoginChallengeToken(challenge) : null;
    if (!challengeResult) {
      return NextResponse.json({ error: "Verification session expired. Sign in again." }, { status: 401 });
    }
    const { clientId, stayLoggedIn } = challengeResult;

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Enter the 6-digit code." }, { status: 400 });
    }
    const turn = await verifyTurnstileToken(parsed.data.turnstileToken, req);
    if (!turn.ok) {
      return NextResponse.json({ error: turn.error }, { status: turn.status });
    }
    const { code, next: nextRaw } = parsed.data;
    const nextPath = safeInternalNextPath(nextRaw);

    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (client?.safetySuspended) {
      return NextResponse.json(
        {
          error:
            "Your client account is suspended pending a Match Fit safety review. You will regain access once the review is complete.",
          code: "ACCOUNT_SUSPENDED",
        },
        { status: 403 },
      );
    }
    if (!client?.twoFactorOtpHash || !client.twoFactorOtpExpires) {
      return NextResponse.json(
        { error: "No active verification code. Request a new code or sign in again.", codeInvalidated: true },
        { status: 400 },
      );
    }
    if (client.twoFactorOtpExpires < new Date()) {
      return NextResponse.json(
        { error: "That code has expired. Request a new code or sign in again.", codeInvalidated: true },
        { status: 400 },
      );
    }
    if (!verifyOtp(code, client.twoFactorOtpHash)) {
      const prev = client.twoFactorLoginAttempts ?? 0;
      const attempts = prev + 1;
      if (attempts >= MAX_ATTEMPTS) {
        await prisma.client.update({
          where: { id: clientId },
          data: {
            twoFactorOtpHash: null,
            twoFactorOtpExpires: null,
            twoFactorLoginAttempts: 0,
          },
        });
        return NextResponse.json(
          {
            error: "Too many incorrect codes. Your verification code has been cancelled. Request a new code.",
            codeInvalidated: true,
            tooManyAttempts: true,
          },
          { status: 400 },
        );
      }
      await prisma.client.update({
        where: { id: clientId },
        data: { twoFactorLoginAttempts: attempts },
      });
      const remaining = MAX_ATTEMPTS - attempts;
      return NextResponse.json(
        {
          error: `Invalid verification code. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`,
          attemptsRemaining: remaining,
        },
        { status: 400 },
      );
    }

    await prisma.client.update({
      where: { id: clientId },
      data: {
        twoFactorOtpHash: null,
        twoFactorOtpExpires: null,
        twoFactorLoginAttempts: 0,
        stayLoggedIn,
      },
    });
    await clearLoginChallengeCookie();
    await setClientSession(clientId, stayLoggedIn);
    return NextResponse.json({ ok: true, ...(nextPath ? { next: nextPath } : {}) });
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Verification could not be completed. Try again.", {
      logLabel: "[Match Fit complete 2FA]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
