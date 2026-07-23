import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ensureOutreachHubSchema,
  isMissingOutreachHubSchemaError,
} from "@/lib/ensure-outreach-hub-schema";
import { queueOutreachDispatch } from "@/lib/outreach-dispatch";
import { OUTREACH_PLATFORM_VALUES } from "@/lib/outreach-types";
import { resolveOutreachActor } from "@/lib/require-service-token";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  leadIds: z
    .array(z.object({ id: z.string().min(1), platform: z.enum(OUTREACH_PLATFORM_VALUES) }))
    .min(1)
    .max(200),
});

export async function POST(req: Request) {
  const actor = await resolveOutreachActor(req);
  if (!actor) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  try {
    await ensureOutreachHubSchema();
    const result = await queueOutreachDispatch({
      leads: parsed.data.leadIds,
      adminId: actor.adminId,
    });
    return NextResponse.json(result);
  } catch (e) {
    console.error("[outreach dispatch queue]", e);
    if (isMissingOutreachHubSchemaError(e)) {
      return NextResponse.json({ error: "Outreach schema is still updating." }, { status: 503 });
    }
    return NextResponse.json({ error: "Could not queue dispatch." }, { status: 500 });
  }
}
