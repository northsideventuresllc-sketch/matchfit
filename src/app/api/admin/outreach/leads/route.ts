import { NextResponse } from "next/server";
import { z } from "zod";
import { listOutreachLeads } from "@/lib/outreach-data";
import { ensureOutreachHubSchema, isMissingOutreachHubSchemaError } from "@/lib/ensure-outreach-hub-schema";
import { OUTREACH_PLATFORM_VALUES, type OutreachPlatform } from "@/lib/outreach-types";
import { requireAdminSession } from "@/lib/require-admin";

const querySchema = z.object({
  platform: z.enum(OUTREACH_PLATFORM_VALUES),
  includeDeleted: z.enum(["0", "1"]).optional(),
});

export async function GET(req: Request) {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    platform: url.searchParams.get("platform"),
    includeDeleted: url.searchParams.get("includeDeleted") ?? "0",
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid platform." }, { status: 400 });
  }

  try {
    await ensureOutreachHubSchema();
    const leads = await listOutreachLeads(
      parsed.data.platform as OutreachPlatform,
      parsed.data.includeDeleted === "1",
    );
    return NextResponse.json({ leads });
  } catch (e) {
    console.error("[outreach leads GET]", e);
    if (isMissingOutreachHubSchemaError(e)) {
      return NextResponse.json(
        {
          error:
            "Outreach database schema is still updating. Wait a moment and refresh, or confirm DIRECT_URL is set on the server.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: "Could not load outreach leads." }, { status: 500 });
  }
}
