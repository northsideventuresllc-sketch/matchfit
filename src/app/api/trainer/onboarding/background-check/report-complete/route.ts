import { trainerReportsPlanBScreeningComplete } from "@/lib/background-check-plan-b";
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
      return NextResponse.json({ error: "Not applicable when Checkr API is connected." }, { status: 400 });
    }

    const result = await trainerReportsPlanBScreeningComplete(trainerId);
    if (!result.ok) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, message: result.message });
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Could not record screening completion.", {
      logLabel: "[trainer bg report-complete]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
