import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ensureOutreachHubSchema,
  isMissingOutreachHubSchemaError,
} from "@/lib/ensure-outreach-hub-schema";
import { setManualSentState } from "@/lib/outreach-dispatch";
import { OUTREACH_PLATFORM_VALUES } from "@/lib/outreach-types";
import { requireAdminSession } from "@/lib/require-admin";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  id: z.string().min(1),
  platform: z.enum(OUTREACH_PLATFORM_VALUES),
  sent: z.boolean(),
});

/** Send Queue "Manual" section sent/not-sent toggle. */
export async function PATCH(req: Request) {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  try {
    await ensureOutreachHubSchema();
    const result = await setManualSentState(parsed.data);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[outreach send manual-sent]", e);
    if (isMissingOutreachHubSchemaError(e)) {
      return NextResponse.json({ error: "Outreach schema is still updating." }, { status: 503 });
    }
    return NextResponse.json({ error: "Could not update send status." }, { status: 500 });
  }
}
