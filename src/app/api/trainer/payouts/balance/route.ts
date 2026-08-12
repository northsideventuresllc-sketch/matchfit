import { getSessionTrainerId } from "@/lib/session";
import { getTrainerEarningsBalanceCents } from "@/lib/trainer-earnings-ledger";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const trainerId = await getSessionTrainerId();
  if (!trainerId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const balanceCents = await getTrainerEarningsBalanceCents(trainerId);
  return NextResponse.json({ balanceCents });
}
