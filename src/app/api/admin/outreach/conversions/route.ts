import { NextResponse } from "next/server";
import {
  ensureOutreachHubSchema,
  isMissingOutreachHubSchemaError,
} from "@/lib/ensure-outreach-hub-schema";
import { listOutreachConvertedLeads } from "@/lib/outreach-conversions";
import { requireAdminSession } from "@/lib/require-admin";

export const dynamic = "force-dynamic";

/** Successful Conversions tab: every lead marked Converted, each with its full touch history. */
export async function GET() {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  try {
    await ensureOutreachHubSchema();
    const entries = await listOutreachConvertedLeads();
    return NextResponse.json({ entries });
  } catch (e) {
    console.error("[outreach conversions GET]", e);
    if (isMissingOutreachHubSchemaError(e)) {
      return NextResponse.json(
        { error: "Outreach conversions schema is still updating. Confirm DIRECT_URL is set on the server." },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: "Could not load conversions." }, { status: 500 });
  }
}
