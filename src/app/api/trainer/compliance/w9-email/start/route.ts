import { deliverSignupOtp } from "@/lib/deliver-otp";
import { generateSixDigitCode, hashOtp } from "@/lib/otp";
import { prisma } from "@/lib/prisma";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";
import { getSessionTrainerId } from "@/lib/session";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const trainer = await prisma.trainer.findUnique({
      where: { id: trainerId },
      select: { email: true, phone: true },
    });
    const profile = await prisma.trainerProfile.findUnique({
      where: { trainerId },
      select: { hasUploadedW9: true, w9Json: true },
    });

    if (!trainer || !profile?.hasUploadedW9 || !profile.w9Json?.trim()) {
      return NextResponse.json({ error: "No W-9 on file to email." }, { status: 400 });
    }

    const code = generateSixDigitCode();
    const otpHash = hashOtp(code);
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.trainerProfile.update({
      where: { trainerId },
      data: {
        w9SelfServeEmailOtpHash: otpHash,
        w9SelfServeEmailOtpExpires: otpExpiresAt,
      },
    });

    await deliverSignupOtp("EMAIL", {
      email: trainer.email,
      phone: trainer.phone,
      code,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Could not send verification code.", {
      logLabel: "[Match Fit trainer w9-email start]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
