import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { clientHasPaidTrainerOnce } from "@/lib/trainer-client-booking-credits";
import {
  normalizePhoneE164,
  publicAppBaseUrl,
  signVoiceBridgeToken,
  twilioCreateMaskedBridgeCall,
  twilioVoiceConfigured,
} from "@/lib/twilio-voice-bridge";
import { isTrainerClientChatBlocked } from "@/lib/user-block-queries";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ clientUsername: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    if (!twilioVoiceConfigured()) {
      return NextResponse.json({ error: "Masked calling is not configured on this server." }, { status: 503 });
    }
    const base = publicAppBaseUrl();
    if (!base) {
      return NextResponse.json({ error: "NEXT_PUBLIC_APP_URL must be set for Twilio callbacks." }, { status: 503 });
    }

    const { clientUsername } = await ctx.params;
    const handle = decodeURIComponent(clientUsername).trim();
    const client = await prisma.client.findUnique({
      where: { username: handle },
      select: { id: true, phone: true, deidentifiedAt: true },
    });
    if (!client || client.deidentifiedAt) {
      return NextResponse.json({ error: "Client not found." }, { status: 404 });
    }
    if (await isTrainerClientChatBlocked(trainerId, client.id)) {
      return NextResponse.json({ error: "Unavailable." }, { status: 403 });
    }
    const paid = await clientHasPaidTrainerOnce(client.id, trainerId);
    if (!paid) {
      return NextResponse.json(
        { error: "Calls unlock after this client completes at least one paid checkout with you on Match Fit." },
        { status: 403 },
      );
    }

    const trainer = await prisma.trainer.findUnique({
      where: { id: trainerId },
      select: { phone: true, deidentifiedAt: true },
    });
    if (!trainer?.phone || trainer.deidentifiedAt) {
      return NextResponse.json({ error: "Your account needs a phone number on file." }, { status: 400 });
    }

    const trainerE164 = normalizePhoneE164(trainer.phone);
    const clientE164 = normalizePhoneE164(client.phone);
    if (!trainerE164 || !clientE164) {
      return NextResponse.json({ error: "Could not normalize phone numbers for dialing." }, { status: 400 });
    }

    const jwt = await signVoiceBridgeToken(clientE164);
    const twimlUrl = `${base}/api/twilio/voice/dial-second?token=${encodeURIComponent(jwt)}`;
    const started = await twilioCreateMaskedBridgeCall({
      initiatorE164: trainerE164,
      twimlUrl,
    });
    if ("error" in started) {
      return NextResponse.json({ error: started.error }, { status: 502 });
    }
    return NextResponse.json({ ok: true, message: "Your phone should ring momentarily. Answer to be connected." });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not start call." }, { status: 500 });
  }
}
