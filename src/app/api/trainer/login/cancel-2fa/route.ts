import { publicApiErrorFromUnknown } from "@/lib/public-api-error";
import { clearTrainerLoginChallengeCookie } from "@/lib/session";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    await clearTrainerLoginChallengeCookie();
    return NextResponse.json({ ok: true });
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Could not cancel verification. Try again.", {
      logLabel: "[Match Fit trainer cancel 2FA]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
