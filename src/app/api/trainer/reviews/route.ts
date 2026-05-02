import { NextResponse } from "next/server";
import { listTrainerDashboardReviews } from "@/lib/client-trainer-reviews";
import { getSessionTrainerId } from "@/lib/session";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const data = await listTrainerDashboardReviews(trainerId);
    return NextResponse.json(data);
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Could not load reviews.", {
      logLabel: "[trainer/reviews GET]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
