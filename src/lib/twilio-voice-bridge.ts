import { SignJWT, jwtVerify } from "jose";
import { getAuthSecretKey } from "@/lib/session";

export function twilioVoiceConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID?.trim() &&
      process.env.TWILIO_AUTH_TOKEN?.trim() &&
      process.env.TWILIO_VOICE_FROM_NUMBER?.trim(),
  );
}

export function publicAppBaseUrl(): string | null {
  const u = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  return u || null;
}

/** Best-effort US E.164 for Twilio outbound. */
export function normalizePhoneE164(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const d = raw.replace(/\D/g, "");
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith("1")) return `+${d}`;
  if (raw.trim().startsWith("+") && d.length >= 10) return `+${d}`;
  return null;
}

export async function signVoiceBridgeToken(calleeE164: string): Promise<string> {
  return new SignJWT({ t: "voice_bridge", callee: calleeE164 })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("10m")
    .sign(getAuthSecretKey());
}

export async function verifyVoiceBridgeToken(token: string): Promise<{ callee: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getAuthSecretKey());
    if (payload.t !== "voice_bridge" || typeof payload.callee !== "string") return null;
    const n = normalizePhoneE164(payload.callee);
    if (!n) return null;
    return { callee: n };
  } catch {
    return null;
  }
}

export async function twilioCreateMaskedBridgeCall(args: {
  initiatorE164: string;
  twimlUrl: string;
}): Promise<{ ok: true; callSid: string } | { error: string }> {
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  const from = process.env.TWILIO_VOICE_FROM_NUMBER?.trim();
  if (!sid || !token || !from) {
    return { error: "Twilio is not configured." };
  }
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const body = new URLSearchParams({
    To: args.initiatorE164,
    From: from,
    Url: args.twimlUrl,
  });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Calls.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });
  const json = (await res.json().catch(() => null)) as { sid?: string; message?: string } | null;
  if (!res.ok) {
    return { error: json?.message || "Twilio call failed." };
  }
  if (!json?.sid) return { error: "Twilio did not return a call SID." };
  return { ok: true, callSid: json.sid };
}
