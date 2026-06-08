import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdPerformancePanel } from "@/lib/ad-platform-performance";
import { requireAdminSession } from "@/lib/require-admin";

const querySchema = z.object({
  days: z.coerce.number().int().min(1).max(30).optional(),
});

export async function GET(req: Request) {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const url = new URL(req.url);
  const parsed = querySchema.safeParse({ days: url.searchParams.get("days") ?? undefined });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid window." }, { status: 400 });
  }

  try {
    const panel = await getAdPerformancePanel(parsed.data.days ?? 7);
    return NextResponse.json({ panel });
  } catch (e) {
    console.error("[ad-tracking performance GET]", e);
    return NextResponse.json({ error: "Could not load ad performance." }, { status: 500 });
  }
}
