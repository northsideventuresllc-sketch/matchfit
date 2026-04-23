import { verifyOtp } from "@/lib/otp";
import { prisma } from "@/lib/prisma";
import { getSessionClientId } from "@/lib/session";
import { firstZodErrorMessage, settingsPhoneChangeCompleteSchema } from "@/lib/validations/client-settings-profile";
import { NextResponse } from "next/server";

const CLEAR_PHONE_CHANGE = {
  pendingPhone: null,
  phoneChangeOtpHash: null,
  phoneChangeOtpExpires: null,
} as const;

export async function POST(req: Request) {
  try {
    const clientId = await getSessionClientId();
    if (!clientId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const parsed = settingsPhoneChangeCompleteSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: firstZodErrorMessage(parsed.error) }, { status: 400 });
    }

    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client?.phoneChangeOtpHash || !client.phoneChangeOtpExpires || !client.pendingPhone) {
      return NextResponse.json({ error: "Start the phone change from settings first." }, { status: 400 });
    }
    if (client.phoneChangeOtpExpires < new Date()) {
      return NextResponse.json({ error: "That code has expired. Request a new code." }, { status: 400 });
    }
    if (!verifyOtp(parsed.data.code, client.phoneChangeOtpHash)) {
      return NextResponse.json({ error: "Invalid verification code." }, { status: 400 });
    }

    const newPhone = client.pendingPhone;

    await prisma.client.update({
      where: { id: clientId },
      data: {
        phone: newPhone,
        ...CLEAR_PHONE_CHANGE,
      },
    });

    return NextResponse.json({ ok: true, phone: newPhone });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not update phone number." }, { status: 500 });
  }
}
