import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ensureOutreachHubSchema,
  isMissingOutreachHubSchemaError,
} from "@/lib/ensure-outreach-hub-schema";
import { OUTREACH_PLATFORM_VALUES, type OutreachPlatform } from "@/lib/outreach-types";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/require-admin";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  platform: z.enum(OUTREACH_PLATFORM_VALUES),
  pendingResponseDraft: z.string().max(8000),
});

/**
 * Autosave for the Pending Responses reply editor (WF2 item 5/8). Persists ONLY the reply draft
 * text + its timestamp — deliberately does not touch lane/status/classification, so editing a
 * reply never bounces the lead between tabs. Instagram and email only (Facebook has no reply flow).
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await ctx.params;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const platform = parsed.data.platform as OutreachPlatform;
  const data = { pendingResponseDraft: parsed.data.pendingResponseDraft, pendingResponseDraftAt: new Date() };

  try {
    await ensureOutreachHubSchema();
    let count = 0;
    if (platform === "instagram") {
      ({ count } = await prisma.outreachInstagramLead.updateMany({ where: { id }, data }));
    } else if (platform === "email") {
      ({ count } = await prisma.outreachEmailLead.updateMany({ where: { id }, data }));
    } else {
      return NextResponse.json({ error: "Replies are Instagram or email only." }, { status: 400 });
    }
    if (count === 0) return NextResponse.json({ error: "Lead not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[outreach response-draft]", e);
    if (isMissingOutreachHubSchemaError(e)) {
      return NextResponse.json({ error: "Outreach schema is still updating." }, { status: 503 });
    }
    return NextResponse.json({ error: "Could not save reply." }, { status: 500 });
  }
}
