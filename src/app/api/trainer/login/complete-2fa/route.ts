import { verifyOtp } from "@/lib/otp";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import {
  applyTrainerSessionToNextResponse,
  TRAINER_LOGIN_CHALLENGE_COOKIE,
  verifyTrainerLoginChallengeToken,
} from "@/lib/session";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  code: z.string().regex(/^\d{6}$/),
});

const MAX_ATTEMPTS = 3;

export async function POST(req: Request) {
  try {
    const store = await cookies();
    const challenge = store.get(TRAINER_LOGIN_CHALLENGE_COOKIE)?.value;
    const challengeResult = challenge ? await verifyTrainerLoginChallengeToken(challenge) : null;
    if (!challengeResult) {
      return NextResponse.json({ error: "Verification session expired. Sign in again." }, { status: 401 });
    }
    const { trainerId, stayLoggedIn, redirectAfter } = challengeResult;

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Enter the 6-digit code." }, { status: 400 });
    }
    const { code } = parsed.data;

    const trainer = await prisma.trainer.findUnique({ where: { id: trainerId } });
    if (!trainer?.twoFactorOtpHash || !trainer.twoFactorOtpExpires) {
      return NextResponse.json(
        { error: "No active verification code. Request a new code or sign in again.", codeInvalidated: true },
        { status: 400 },
      );
    }
    if (trainer.twoFactorOtpExpires < new Date()) {
      return NextResponse.json(
        { error: "That code has expired. Request a new code or sign in again.", codeInvalidated: true },
        { status: 400 },
      );
    }
    if (!verifyOtp(code, trainer.twoFactorOtpHash)) {
      const prev = trainer.twoFactorLoginAttempts ?? 0;
      const attempts = prev + 1;
      if (attempts >= MAX_ATTEMPTS) {
        await prisma.trainer.update({
          where: { id: trainerId },
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
      await prisma.trainer.update({
        where: { id: trainerId },
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

    await prisma.trainer.update({
      where: { id: trainerId },
      data: {
        twoFactorOtpHash: null,
        twoFactorOtpExpires: null,
        twoFactorLoginAttempts: 0,
        stayLoggedIn,
      },
    });
    const next = redirectAfter ?? "/trainer/dashboard";
    const res = NextResponse.json({ ok: true, next });
    res.cookies.delete(TRAINER_LOGIN_CHALLENGE_COOKIE);
    await applyTrainerSessionToNextResponse(res, trainerId, stayLoggedIn);
    return res;
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Verification could not be completed. Try again.", {
      logLabel: "[Match Fit trainer complete 2FA]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
