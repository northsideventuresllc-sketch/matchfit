import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function authorize(req: Request): boolean {
  const secret = process.env.MATCHFIT_ADMIN_API_SECRET?.trim();
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

/** Lists pending chat leakage / PII flags for internal review (Terms §1 leakage detection). */
export async function GET(req: Request) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const rows = await prisma.chatAdminReviewItem.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      createdAt: true,
      conversationId: true,
      authorRole: true,
      matchedSignalsJson: true,
      bodyExcerpt: true,
    },
  });
  return NextResponse.json({
    items: rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      matchedSignals: JSON.parse(r.matchedSignalsJson) as string[],
    })),
  });
}
