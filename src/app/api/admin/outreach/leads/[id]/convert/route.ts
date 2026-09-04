import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ensureOutreachHubSchema,
  isMissingOutreachHubSchemaError,
} from "@/lib/ensure-outreach-hub-schema";
import { setOutreachLeadConversion } from "@/lib/outreach-conversions";
import { OUTREACH_PLATFORM_VALUES } from "@/lib/outreach-types";
import { requireAdminSession } from "@/lib/require-admin";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  platform: z.enum(OUTREACH_PLATFORM_VALUES),
  matchedAccountType: z.enum(["client", "trainer"]).nullable().optional(),
  matchedAccountId: z.string().min(1).nullable().optional(),
});

/**
 * "Converted" (Pending Responses → Successful Conversions): idempotent — clicking it again (e.g.
 * to link/change the matched account later) never re-stamps `convertedAt`, only updates the
 * account-link fields. Linking an account is optional; this never blocks on finding a match.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await ctx.params;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  try {
    await ensureOutreachHubSchema();
    const result = await setOutreachLeadConversion({
      platform: parsed.data.platform,
      id,
      adminId: sess.adminId,
      matchedAccountType: parsed.data.matchedAccountType,
      matchedAccountId: parsed.data.matchedAccountId,
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[outreach lead convert]", e);
    if (isMissingOutreachHubSchemaError(e)) {
      return NextResponse.json({ error: "Outreach schema is still updating." }, { status: 503 });
    }
    return NextResponse.json({ error: "Could not mark lead converted." }, { status: 500 });
  }
}
