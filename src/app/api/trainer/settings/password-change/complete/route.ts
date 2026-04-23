import { hashPassword } from "@/lib/password";
import { verifyPasswordChangeToken } from "@/lib/password-change-jwt";
import { verifyOtp } from "@/lib/otp";
import { prisma } from "@/lib/prisma";
import { clearTrainerSession, getSessionTrainerId } from "@/lib/session";
import { firstZodErrorMessage, passwordChangeCompleteSchema } from "@/lib/validations/client-register";
import { NextResponse } from "next/server";

const CLEAR_PASSWORD_CHANGE = {
  passwordChangeNonce: null,
  passwordChangeExpires: null,
  passwordChangeOtpHash: null,
  passwordChangeOtpExpires: null,
} as const;

export async function POST(req: Request) {
  try {
    const parsed = passwordChangeCompleteSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: firstZodErrorMessage(parsed.error) }, { status: 400 });
    }
    const body = parsed.data;

    if (body.mode === "email") {
      const claims = await verifyPasswordChangeToken(body.token);
      if (!claims) {
        return NextResponse.json({ error: "This reset link is invalid or has expired." }, { status: 400 });
      }

      const trainer = await prisma.trainer.findUnique({ where: { id: claims.userId } });
      if (
        !trainer?.passwordChangeNonce ||
        !trainer.passwordChangeExpires ||
        trainer.passwordChangeNonce !== claims.nonce
      ) {
        return NextResponse.json(
          { error: "This reset link is no longer valid. Request a new one from settings." },
          { status: 400 },
        );
      }
      if (trainer.passwordChangeExpires < new Date()) {
        return NextResponse.json({ error: "This reset link has expired. Request a new one." }, { status: 400 });
      }

      const passwordHash = await hashPassword(body.newPassword);
      await prisma.trainer.update({
        where: { id: trainer.id },
        data: {
          passwordHash,
          ...CLEAR_PASSWORD_CHANGE,
          twoFactorOtpHash: null,
          twoFactorOtpExpires: null,
        },
      });

      await clearTrainerSession();
      return NextResponse.json({ ok: true, next: "/trainer/dashboard/login?passwordReset=1" });
    }

    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const trainer = await prisma.trainer.findUnique({ where: { id: trainerId } });
    if (!trainer?.passwordChangeOtpHash || !trainer.passwordChangeOtpExpires) {
      return NextResponse.json({ error: "Start the password change from settings first." }, { status: 400 });
    }
    if (trainer.passwordChangeOtpExpires < new Date()) {
      return NextResponse.json({ error: "That code has expired. Request a new code." }, { status: 400 });
    }
    if (!verifyOtp(body.code, trainer.passwordChangeOtpHash)) {
      return NextResponse.json({ error: "Invalid verification code." }, { status: 400 });
    }

    const passwordHash = await hashPassword(body.newPassword);
    await prisma.trainer.update({
      where: { id: trainerId },
      data: {
        passwordHash,
        ...CLEAR_PASSWORD_CHANGE,
        twoFactorOtpHash: null,
        twoFactorOtpExpires: null,
      },
    });

    await clearTrainerSession();
    return NextResponse.json({ ok: true, next: "/trainer/dashboard/login?passwordReset=1" });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not update password." }, { status: 500 });
  }
}
