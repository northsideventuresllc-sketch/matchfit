import { getSessionTrainerId } from "@/lib/session";
import { listTrainerPayoutRequests } from "@/lib/trainer-payouts";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const trainerId = await getSessionTrainerId();
  if (!trainerId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const requests = await listTrainerPayoutRequests(trainerId);
  return NextResponse.json({
    requests: requests.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      amountCents: r.amountCents,
      method: r.method,
      feeCents: r.feeCents,
      netCents: r.netCents,
      status: r.status,
      failureReason: r.failureReason,
    })),
  });
}
