import { NextResponse } from "next/server";
import { listOutreachArchiveLeads } from "@/lib/outreach-data";
import {
  ensureOutreachHubSchema,
  isMissingOutreachHubSchemaError,
} from "@/lib/ensure-outreach-hub-schema";
import { requireAdminSession } from "@/lib/require-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  try {
    await ensureOutreachHubSchema();
    const entries = await listOutreachArchiveLeads();
    return NextResponse.json({ entries });
  } catch (e) {
    console.error("[outreach archive GET]", e);
    if (isMissingOutreachHubSchemaError(e)) {
      return NextResponse.json(
        {
          error:
            "Outreach archive schema is still updating. Use Repair Outreach Hub schema, or confirm DIRECT_URL is set on the server.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: "Could not load archive." }, { status: 500 });
  }
}
