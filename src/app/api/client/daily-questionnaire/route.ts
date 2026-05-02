import { listDailyQuestionnaireHistory, resolveDailyQuestionnaireState } from "@/lib/client-daily-questionnaire";
import { getSessionClientId } from "@/lib/session";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const clientId = await getSessionClientId();
    if (!clientId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const [resolved, history] = await Promise.all([
      resolveDailyQuestionnaireState(clientId),
      listDailyQuestionnaireHistory(clientId),
    ]);
    if (resolved.state === "cooldown") {
      return NextResponse.json({
        state: "cooldown",
        nextAvailableAt: resolved.nextAvailableAt,
        serverNow: new Date().toISOString(),
        history,
      });
    }

    return NextResponse.json({
      state: "active",
      serverNow: new Date().toISOString(),
      questionnaire: resolved.questionnaire,
      history,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not load questionnaire." }, { status: 500 });
  }
}
