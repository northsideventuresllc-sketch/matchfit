import { requestTrainerBackgroundCheckInvite } from "@/lib/background-check-plan-b";
import { isBackgroundCheckPlanBActive } from "@/lib/checkr-integration";
import { getSessionTrainerId } from "@/lib/session";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    if (!isBackgroundCheckPlanBActive()) {
      return NextResponse.json(
        { error: "Automated Checkr is available — use the integrated screening flow." },
        { status: 400 },
      );
    }

    const result = await requestTrainerBackgroundCheckInvite(trainerId);
    if (!result.ok) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      mode: result.mode,
      message: result.message,
      invitationUrl: result.invitationUrl ?? null,
    });
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Could not request screening invite.", {
      logLabel: "[trainer bg request-invite]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
