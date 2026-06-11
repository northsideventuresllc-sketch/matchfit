import { NextResponse } from "next/server";
import { listOutreachHubLeads } from "@/lib/outreach-data";
import { requireAdminSession } from "@/lib/require-admin";

export async function GET() {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  try {
    const leads = await listOutreachHubLeads();
    return NextResponse.json({ leads, total: leads.length });
  } catch (e) {
    console.error("[outreach hub GET]", e);
    return NextResponse.json({ error: "Could not load outreach hub." }, { status: 500 });
  }
}
