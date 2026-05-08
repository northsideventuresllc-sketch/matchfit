import { loadTrainerFinanceStats } from "@/lib/trainer-client-management-dashboard";
import { getSessionTrainerId } from "@/lib/session";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const url = new URL(req.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    if (!from || !to) return NextResponse.json({ error: "from and to (ISO) are required." }, { status: 400 });
    const rangeStart = new Date(from);
    const rangeEnd = new Date(to);
    if (Number.isNaN(rangeStart.getTime()) || Number.isNaN(rangeEnd.getTime()) || rangeEnd <= rangeStart) {
      return NextResponse.json({ error: "Invalid range." }, { status: 400 });
    }
    const maxSpanMs = 366 * 2 * 24 * 60 * 60 * 1000;
    if (rangeEnd.getTime() - rangeStart.getTime() > maxSpanMs) {
      return NextResponse.json({ error: "Range may not exceed two years." }, { status: 400 });
    }

    const stats = await loadTrainerFinanceStats(trainerId, rangeStart, rangeEnd);
    return NextResponse.json(stats);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not load stats." }, { status: 500 });
  }
}
