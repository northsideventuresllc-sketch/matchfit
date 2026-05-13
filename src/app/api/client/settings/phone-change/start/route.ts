import { deliverSignupOtp } from "@/lib/deliver-otp";
import { isPhoneTakenByAnother } from "@/lib/client-queries";
import { generateSixDigitCode, hashOtp } from "@/lib/otp";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { getSessionClientId } from "@/lib/session";
import { firstZodErrorMessage, settingsPhoneChangeStartSchema } from "@/lib/validations/client-settings-profile";
import { NextResponse } from "next/server";

const RESEND_MIN_MS = 90_000;

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

    await deliverSignupOtp("EMAIL", {
      email: client.email,
      phone: trimmed,
      code,
      clientId,
    });

    return NextResponse.json({
      ok: true,
      flow: "EMAIL" as const,
      pendingPhone: trimmed,
      message:
        "We emailed a 6-digit code to your current email address to confirm this phone change. Enter it on the next step.",
    });
  } catch (e) {
    console.error(e);
    const message = e instanceof Error ? e.message : "Could not start phone change.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
