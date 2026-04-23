import { deliverSignupOtp, shouldMockSmsVoiceOtp } from "@/lib/deliver-otp";
import type { OtpChannel } from "@/lib/deliver-otp";
import { isPhoneTakenByAnother } from "@/lib/client-queries";
import { generateSixDigitCode, hashOtp } from "@/lib/otp";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { getSessionClientId } from "@/lib/session";
import { firstZodErrorMessage, settingsPhoneChangeStartSchema } from "@/lib/validations/client-settings-profile";
import { NextResponse } from "next/server";

const RESEND_MIN_MS = 90_000;

function shouldSendSmsForPhoneChangeOtp(): boolean {
  if (shouldMockSmsVoiceOtp()) return true;
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_FROM_NUMBER,
  );
}

export async function POST(req: Request) {
  try {
    const clientId = await getSessionClientId();
    if (!clientId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const parsed = settingsPhoneChangeStartSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: firstZodErrorMessage(parsed.error) }, { status: 400 });
    }
    const { newPhone, currentPassword } = parsed.data;
    const trimmed = newPhone.trim();

    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const pwOk = await verifyPassword(currentPassword, client.passwordHash);
    if (!pwOk) {
      return NextResponse.json({ error: "Current password is incorrect." }, { status: 401 });
    }

    if (trimmed === client.phone) {
      return NextResponse.json({ error: "That is already your phone number." }, { status: 400 });
    }

    if (client.lastPhoneChangeRequest) {
      const elapsed = Date.now() - client.lastPhoneChangeRequest.getTime();
      if (elapsed < RESEND_MIN_MS) {
        return NextResponse.json(
          { error: "Please wait a minute before requesting another phone change." },
          { status: 429 },
        );
      }
    }

    if (await isPhoneTakenByAnother(trimmed, clientId)) {
      return NextResponse.json({ error: "That phone number is already in use." }, { status: 400 });
    }

    const code = generateSixDigitCode();
    const otpHash = hashOtp(code);
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.client.update({
      where: { id: clientId },
      data: {
        pendingPhone: trimmed,
        phoneChangeOtpHash: otpHash,
        phoneChangeOtpExpires: otpExpiresAt,
        lastPhoneChangeRequest: new Date(),
      },
    });

    const useSms: OtpChannel = shouldSendSmsForPhoneChangeOtp() ? "SMS" : "EMAIL";
    const deliveryMeta = await deliverSignupOtp(useSms, {
      email: client.email,
      phone: trimmed,
      code,
    });

    const devMock = Boolean(deliveryMeta?.devPhoneMock);
    return NextResponse.json({
      ok: true,
      flow: useSms,
      pendingPhone: trimmed,
      devPhoneMock: devMock,
      message: devMock
        ? "Development mode: your 6-digit code was printed in the server terminal (SMS not sent). Enter it to confirm your new number."
        : useSms === "SMS"
          ? "We sent a 6-digit code to your new phone number by SMS."
          : "We emailed a 6-digit code to your current email address to confirm this phone change.",
    });
  } catch (e) {
    console.error(e);
    const message = e instanceof Error ? e.message : "Could not start phone change.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
