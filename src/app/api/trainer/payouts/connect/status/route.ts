import { getSessionTrainerId } from "@/lib/session";
import { getTrainerConnectStatus } from "@/lib/stripe-connect";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const trainerId = await getSessionTrainerId();
  if (!trainerId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const status = await getTrainerConnectStatus(trainerId);
  return NextResponse.json(status);
}
