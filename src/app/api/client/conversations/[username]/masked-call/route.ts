import { prisma } from "@/lib/prisma";
import { getSessionClientId } from "@/lib/session";
import { getPhoneCallEligibility } from "@/lib/phone-bridge-eligibility";
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

type Ctx = { params: Promise<{ username: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  try {
    const clientId = await getSessionClientId();
    if (!clientId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    if (!twilioVoiceConfigured()) {
      return NextResponse.json({ error: "Masked calling is not configured on this server." }, { status: 503 });
    }
    const base = publicAppBaseUrl();
    if (!base) {
      return NextResponse.json({ error: "NEXT_PUBLIC_APP_URL must be set for Twilio callbacks." }, { status: 503 });
    }

    const { username } = await ctx.params;
    const handle = decodeURIComponent(username).trim();
    const trainer = await prisma.trainer.findUnique({
      where: { username: handle },
      select: { id: true, phone: true, deidentifiedAt: true },
    });
    if (!trainer || trainer.deidentifiedAt) {
      return NextResponse.json({ error: "Coach not found." }, { status: 404 });
    }
    if (await isTrainerClientChatBlocked(trainer.id, clientId)) {
      return NextResponse.json({ error: "Unavailable." }, { status: 403 });
    }
    const gate = await getPhoneCallEligibility({ clientId, trainerId: trainer.id, archived: false });
    if (!gate.paid) {
      return NextResponse.json(
        { error: "Calls unlock after you complete at least one paid checkout with this coach on Match Fit." },
        { status: 403 },
      );
    }
    if (!gate.clientOptIn || !gate.trainerOptIn) {
      return NextResponse.json(
        {
          error:
            "Both you and your coach must enable Match Fit masked calls in Account Settings before voice connect can start. Your phone number is never shown to the other person.",
        },
        { status: 403 },
      );
    }

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { phone: true, deidentifiedAt: true },
    });
    if (!client?.phone || client.deidentifiedAt) {
      return NextResponse.json({ error: "Your account needs a phone number on file." }, { status: 400 });
    }

    const clientE164 = normalizePhoneE164(client.phone);
    const trainerE164 = normalizePhoneE164(trainer.phone);
    if (!clientE164 || !trainerE164) {
      return NextResponse.json({ error: "Could not normalize phone numbers for dialing." }, { status: 400 });
    }

    const jwt = await signVoiceBridgeToken(trainerE164);
    const twimlUrl = `${base}/api/twilio/voice/dial-second?token=${encodeURIComponent(jwt)}`;
    const started = await twilioCreateMaskedBridgeCall({
      initiatorE164: clientE164,
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
