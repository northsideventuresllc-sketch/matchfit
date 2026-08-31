import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ensureOutreachHubSchema,
  isMissingOutreachHubSchemaError,
} from "@/lib/ensure-outreach-hub-schema";
import { queueManualSend } from "@/lib/outreach-dispatch";
import { OUTREACH_PLATFORM_VALUES } from "@/lib/outreach-types";
import { requireAdminSession } from "@/lib/require-admin";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  leadIds: z
    .array(z.object({ id: z.string().min(1), platform: z.enum(OUTREACH_PLATFORM_VALUES) }))
    .min(1)
    .max(200),
});

/** Manual Send: queues leads into the Send Queue tab's Manual section (no Cowork batch). */
export async function POST(req: Request) {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  try {
    await ensureOutreachHubSchema();
    const result = await queueManualSend({ leads: parsed.data.leadIds });
    return NextResponse.json(result);
  } catch (e) {
    console.error("[outreach send manual]", e);
    if (isMissingOutreachHubSchemaError(e)) {
      return NextResponse.json({ error: "Outreach schema is still updating." }, { status: 503 });
    }
    return NextResponse.json({ error: "Could not queue manual send." }, { status: 500 });
  }
}
