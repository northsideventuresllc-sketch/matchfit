import { NextResponse } from "next/server";
import { verifyVoiceBridgeToken } from "@/lib/twilio-voice-bridge";

export const dynamic = "force-dynamic";

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Twilio fetches this URL when the first leg answers; it bridges to the other party without exposing numbers in the app UI. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token")?.trim();
  if (!token) {
    return twimlResponse("<Response><Say>Missing link.</Say></Response>", 400);
  }
  const payload = await verifyVoiceBridgeToken(token);
  if (!payload) {
    return twimlResponse("<Response><Say>This link has expired.</Say></Response>", 400);
  }
  const from = process.env.TWILIO_VOICE_FROM_NUMBER?.trim() ?? "";
  if (!from) {
    return twimlResponse("<Response><Say>Calling is not available.</Say></Response>", 503);
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice">Connecting you through Match Fit.</Say><Dial callerId="${escapeXml(from)}" timeout="55">${escapeXml(payload.callee)}</Dial></Response>`;
  return twimlResponse(xml, 200);
}

function twimlResponse(body: string, status: number) {
  return new NextResponse(body, {
    status,
    headers: { "Content-Type": "text/xml; charset=utf-8" },
  });
}
