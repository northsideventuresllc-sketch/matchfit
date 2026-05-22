import { cancelScheduledTrainerAccountDeletion } from "@/lib/account-deletion-grace";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";
import { getSessionTrainerId } from "@/lib/session";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const ok = await cancelScheduledTrainerAccountDeletion(trainerId);
    if (!ok) {
      return NextResponse.json(
        { error: "No scheduled deletion to cancel, or the grace period has ended." },
        { status: 400 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Could not cancel scheduled deletion.", {
      logLabel: "[trainer cancel scheduled deletion]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
