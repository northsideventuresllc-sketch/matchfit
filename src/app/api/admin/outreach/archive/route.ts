import { NextResponse } from "next/server";
import { listOutreachArchiveLeads } from "@/lib/outreach-data";
import { requireAdminSession } from "@/lib/require-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  try {
    const entries = await listOutreachArchiveLeads();
    return NextResponse.json({ entries });
  } catch (e) {
    console.error("[outreach archive GET]", e);
    return NextResponse.json({ error: "Could not load archive." }, { status: 500 });
  }
}
