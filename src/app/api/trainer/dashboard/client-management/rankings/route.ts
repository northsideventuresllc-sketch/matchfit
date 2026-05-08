import { loadTrainerRankingsPremiumScoped, type TrainerRankingScope } from "@/lib/trainer-client-management-dashboard";
import { getSessionTrainerId } from "@/lib/session";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function parseScope(raw: string | null): TrainerRankingScope {
  const u = (raw ?? "ZIP").toUpperCase();
  if (u === "GLOBAL" || u === "ALL") return "GLOBAL";
  if (u === "STATE") return "STATE";
  return "ZIP";
}

export async function GET(req: Request) {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    const url = new URL(req.url);
    const scope = parseScope(url.searchParams.get("scope"));
    const data = await loadTrainerRankingsPremiumScoped(trainerId, scope);
    if (!data) return NextResponse.json({ error: "Premium FitHub required." }, { status: 403 });
    return NextResponse.json(data);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not load rankings." }, { status: 500 });
  }
}
