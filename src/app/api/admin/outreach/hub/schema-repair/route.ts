import { NextResponse } from "next/server";
import {
  ensureOutreachHubSchema,
  isMissingOutreachHubSchemaError,
} from "@/lib/ensure-outreach-hub-schema";
import { backfillOutreachHubLeads } from "@/lib/outreach-hub-backfill";
import { formatUserFacingError } from "@/lib/read-json-response";
import { requireAdminSession } from "@/lib/require-admin";

export const dynamic = "force-dynamic";

export async function POST() {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  try {
    await ensureOutreachHubSchema();
    const backfill = await backfillOutreachHubLeads();
    return NextResponse.json({
      ok: true,
      backfill,
      message: `Outreach Hub repaired. Backfilled ${backfill.savedToHubAtFromSignals} saved timestamp(s) and tagged ${backfill.legacyOtherLeadsTagged} legacy contact(s).`,
    });
  } catch (e) {
    console.error("[outreach hub schema-repair]", e);
    return NextResponse.json(
      {
        error: formatUserFacingError(
          e,
          "Could not repair Outreach Hub schema on the database.",
        ),
      },
      { status: isMissingOutreachHubSchemaError(e) ? 503 : 500 },
    );
  }
}
