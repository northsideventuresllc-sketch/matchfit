import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function authorize(req: Request): boolean {
  const secret = process.env.MATCHFIT_ADMIN_API_SECRET?.trim();
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

/** Lists payout disputes awaiting human fund-split review (post–two-gate buffer). */
export async function GET(req: Request) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const rows = await prisma.sessionPayoutDispute.findMany({
    where: { status: "PENDING_ADMIN" },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      createdAt: true,
      bookedTrainingSessionId: true,
      clientId: true,
      answeredWasRescheduled: true,
      answeredWasCancelled: true,
      answeredReasonDetail: true,
      status: true,
    },
  });
  return NextResponse.json({
    items: rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}
