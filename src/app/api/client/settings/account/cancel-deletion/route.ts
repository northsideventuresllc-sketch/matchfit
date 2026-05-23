import { cancelScheduledClientAccountDeletion } from "@/lib/account-deletion-grace";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";
import { getSessionClientId } from "@/lib/session";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    const clientId = await getSessionClientId();
    if (!clientId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const ok = await cancelScheduledClientAccountDeletion(clientId);
    if (!ok) {
      return NextResponse.json(
        { error: "No scheduled deletion to cancel, or the grace period has ended." },
        { status: 400 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Could not cancel scheduled deletion.", {
      logLabel: "[client cancel scheduled deletion]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
