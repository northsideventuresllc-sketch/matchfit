import { buildOutreachHubCsv, listOutreachHubLeads } from "@/lib/outreach-data";
import {
  ensureOutreachHubSchema,
  isMissingOutreachHubSchemaError,
} from "@/lib/ensure-outreach-hub-schema";
import { requireAdminSession } from "@/lib/require-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const sess = await requireAdminSession();
  if (!sess) {
    return new Response("Unauthorized.", { status: 401 });
  }

  try {
    await ensureOutreachHubSchema();
    const leads = await listOutreachHubLeads();
    const csv = buildOutreachHubCsv(leads);
    const stamp = new Date().toISOString().slice(0, 10);

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="match-fit-outreach-hub-${stamp}.csv"`,
      },
    });
  } catch (e) {
    console.error("[outreach hub export GET]", e);
    if (isMissingOutreachHubSchemaError(e)) {
      return new Response(
        "Outreach Hub schema is still updating. Repair schema in Outreach HQ, then retry export.",
        { status: 503 },
      );
    }
    return new Response("Could not export outreach hub.", { status: 500 });
  }
}
