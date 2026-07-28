import { NextResponse } from "next/server";
import { listNiOutreachLeads } from "@/lib/outreach-ni-leads";
import { formatUserFacingError } from "@/lib/read-json-response";
import { requireAdminSession } from "@/lib/require-admin";

/**
 * NI Services outreach lane — read only.
 *
 * Deliberately GET-only: there is no approve route and no send route here. NI outreach reaches a
 * person only after JB has edited and approved every line, and only through the NI Resend account.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  try {
    const leads = await listNiOutreachLeads();
    const webDesign = leads.filter((l) => l.offering === "Custom Web Design and Management").length;
    return NextResponse.json({ leads, total: leads.length, webDesign });
  } catch (e) {
    console.error("[outreach ni GET]", e);
    return NextResponse.json(
      { error: formatUserFacingError(e, "Could not load the NI outreach leads.") },
      { status: 500 },
    );
  }
}
