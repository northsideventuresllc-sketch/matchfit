import { NextResponse } from "next/server";
import { z } from "zod";
import { syncAdPlatformPerformance } from "@/lib/ad-platform-performance";
import { requireAdminSession } from "@/lib/require-admin";

const bodySchema = z.object({
  days: z.number().int().min(1).max(30).optional(),
});

export async function POST(req: Request) {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  let days = 7;
  try {
    const json = await req.json();
    const parsed = bodySchema.safeParse(json);
    if (parsed.success && parsed.data.days) days = parsed.data.days;
  } catch {
    // Empty body is fine — default window.
  }

  try {
    const result = await syncAdPlatformPerformance(days);
    return NextResponse.json(result);
  } catch (e) {
    console.error("[ad-tracking sync POST]", e);
    return NextResponse.json({ error: "Ad platform sync failed." }, { status: 500 });
  }
}
