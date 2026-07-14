import { NextResponse } from "next/server";
import { ensureOutreachHubSchema } from "@/lib/ensure-outreach-hub-schema";
import { buildCoworkMorningBrief } from "@/lib/outreach-ai";
import { requireAdminSession } from "@/lib/require-admin";

export const dynamic = "force-dynamic";

/**
 * Cowork morning brief — daily capped Lead queue + paste-ready runner prompt.
 * MF-OUT-COWORK autonomy surface; JB still owns live DM/email send.
 */
export async function GET() {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  try {
    await ensureOutreachHubSchema();
    const brief = await buildCoworkMorningBrief();
    return NextResponse.json(brief);
  } catch (e) {
    console.error("[outreach cowork-brief]", e);
    return NextResponse.json({ error: "Could not build Cowork morning brief." }, { status: 500 });
  }
}
