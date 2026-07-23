import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ensureOutreachHubSchema,
  isMissingOutreachHubSchemaError,
} from "@/lib/ensure-outreach-hub-schema";
import { pullOutreachDispatch } from "@/lib/outreach-dispatch";
import { requireAdminSession } from "@/lib/require-admin";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  leadIds: z.array(z.string().min(1)).min(1).max(200),
});

export async function POST(req: Request) {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  try {
    await ensureOutreachHubSchema();
    const result = await pullOutreachDispatch({ leadIds: parsed.data.leadIds });
    return NextResponse.json(result);
  } catch (e) {
    console.error("[outreach dispatch pull]", e);
    if (isMissingOutreachHubSchemaError(e)) {
      return NextResponse.json({ error: "Outreach schema is still updating." }, { status: 503 });
    }
    return NextResponse.json({ error: "Could not pull leads from dispatch." }, { status: 500 });
  }
}
