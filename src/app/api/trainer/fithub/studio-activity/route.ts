import { NextResponse } from "next/server";
import { isTrainerPremiumStudioActive } from "@/lib/trainer-premium-studio";
import {
  countTrainerFitHubUnseenInteractions,
  ensureFitHubStudioDigestTrainerNotification,
  getTrainerFitHubStudioSeenAt,
  listTrainerFitHubStudioActivity,
  type FitHubStudioActivityKind,
} from "@/lib/trainer-fithub-studio-activity";
import { getSessionTrainerId } from "@/lib/session";

const FILTERS = new Set<string>(["ALL", "LIKE", "COMMENT", "REPOST", "SHARE"]);

export async function GET(req: Request) {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    if (!(await isTrainerPremiumStudioActive(trainerId))) {
      return NextResponse.json({ error: "Premium Page is required." }, { status: 403 });
    }

    const url = new URL(req.url);
    const raw = url.searchParams.get("filter")?.trim().toUpperCase() ?? "ALL";
    const filter = (FILTERS.has(raw) ? raw : "ALL") as "ALL" | FitHubStudioActivityKind;

    await ensureFitHubStudioDigestTrainerNotification(trainerId);

    const [items, unseenCount, lastSeenAt] = await Promise.all([
      listTrainerFitHubStudioActivity(trainerId, filter === "ALL" ? "ALL" : filter, 150),
      countTrainerFitHubUnseenInteractions(trainerId),
      getTrainerFitHubStudioSeenAt(trainerId),
    ]);

    return NextResponse.json({
      items,
      unseenCount,
      lastSeenAt: lastSeenAt?.toISOString() ?? null,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not load FitHub activity." }, { status: 500 });
  }
}
