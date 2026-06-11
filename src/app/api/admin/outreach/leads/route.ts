import { NextResponse } from "next/server";
import { z } from "zod";
import { listOutreachLeads } from "@/lib/outreach-data";
import { OUTREACH_PLATFORM_VALUES, type OutreachPlatform } from "@/lib/outreach-types";
import { requireAdminSession } from "@/lib/require-admin";

const querySchema = z.object({
  platform: z.enum(OUTREACH_PLATFORM_VALUES),
  includeDeleted: z.enum(["0", "1"]).optional(),
});

export async function GET(req: Request) {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    platform: url.searchParams.get("platform"),
    includeDeleted: url.searchParams.get("includeDeleted") ?? "0",
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid platform." }, { status: 400 });
  }

  try {
    const leads = await listOutreachLeads(
      parsed.data.platform as OutreachPlatform,
      parsed.data.includeDeleted === "1",
    );
    return NextResponse.json({ leads });
  } catch (e) {
    console.error("[outreach leads GET]", e);
    return NextResponse.json({ error: "Could not load outreach leads." }, { status: 500 });
  }
}
