import { NextResponse } from "next/server";
import { z } from "zod";
import { reviveArchivedOutreachLead } from "@/lib/outreach-archive";
import { OUTREACH_PLATFORM_VALUES, type OutreachPlatform } from "@/lib/outreach-types";
import { requireAdminSession } from "@/lib/require-admin";

const reviveSchema = z.object({
  platform: z.enum(OUTREACH_PLATFORM_VALUES),
  id: z.string().trim().min(1),
});

export async function POST(req: Request) {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const parsed = reviveSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    const revived = await reviveArchivedOutreachLead(
      parsed.data.platform as OutreachPlatform,
      parsed.data.id,
    );
    if (!revived) {
      return NextResponse.json({ error: "Lead not found in archive." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, message: "Lead revived to Outreach Hub." });
  } catch (e) {
    console.error("[outreach archive revive]", e);
    return NextResponse.json({ error: "Could not revive lead." }, { status: 500 });
  }
}
