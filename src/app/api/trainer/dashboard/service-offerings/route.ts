import { NextResponse } from "next/server";
import { getSessionTrainerId } from "@/lib/session";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";
import {
  loadTrainerProfileAnswersAndOfferings,
  migrateLegacyQuestionnaireServices,
  parseTrainerServiceOfferingsJson,
} from "@/lib/trainer-service-offerings";

export async function GET() {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    await migrateLegacyQuestionnaireServices(trainerId);

    const profile = await loadTrainerProfileAnswersAndOfferings(trainerId);
    const document = parseTrainerServiceOfferingsJson(profile?.serviceOfferingsJson ?? null);
    return NextResponse.json({ document });
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Could not load service offerings.", {
      logLabel: "[Match Fit trainer service offerings GET]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
