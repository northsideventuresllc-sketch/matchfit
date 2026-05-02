import { NextResponse } from "next/server";
import {
  appendTrainerFitHubStudioReadKeys,
  countTrainerFitHubUnseenInteractions,
  sanitizeFitHubStudioActivityItemIds,
} from "@/lib/trainer-fithub-studio-activity";
import { isTrainerPremiumStudioActive } from "@/lib/trainer-premium-studio";
import { getSessionTrainerId } from "@/lib/session";

export async function POST(req: Request) {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    if (!(await isTrainerPremiumStudioActive(trainerId))) {
      return NextResponse.json({ error: "Premium Page is required." }, { status: 403 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
    }
    const raw = body && typeof body === "object" && body !== null && "itemIds" in body ? (body as { itemIds: unknown }).itemIds : null;
    const itemIds = sanitizeFitHubStudioActivityItemIds(raw);
    if (!itemIds.length) {
      return NextResponse.json({ error: "No valid item ids." }, { status: 400 });
    }

    await appendTrainerFitHubStudioReadKeys(trainerId, itemIds);
    const unseenCount = await countTrainerFitHubUnseenInteractions(trainerId);

    return NextResponse.json({ ok: true, unseenCount });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not update." }, { status: 500 });
  }
}
