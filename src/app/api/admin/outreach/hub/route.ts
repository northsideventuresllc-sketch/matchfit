import { NextResponse } from "next/server";
import { listOutreachHubLeads } from "@/lib/outreach-data";
import {
  ensureOutreachHubSchema,
  isMissingOutreachHubSchemaError,
} from "@/lib/ensure-outreach-hub-schema";
import { formatUserFacingError } from "@/lib/read-json-response";
import { requireAdminSession } from "@/lib/require-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  try {
    await ensureOutreachHubSchema();
    const leads = await listOutreachHubLeads();
    return NextResponse.json({ leads, entries: leads, total: leads.length });
  } catch (e) {
    console.error("[outreach hub GET]", e);
    if (isMissingOutreachHubSchemaError(e)) {
      return NextResponse.json(
        {
          error:
            "Outreach Hub database schema is still updating. Use Repair Outreach Hub schema, or confirm DIRECT_URL is set on the server.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json(
      {
        error: formatUserFacingError(e, "Could not load outreach hub."),
      },
      { status: 500 },
    );
  }
}
