import { NextResponse } from "next/server";
import { z } from "zod";
import { formatUserFacingError } from "@/lib/read-json-response";
import { hydratePlatformEnvFromDatabase } from "@/lib/hydrate-platform-env";
import { ensureOutreachHubSchema } from "@/lib/ensure-outreach-hub-schema";
import { generateOutreachLeadCopy } from "@/lib/outreach-copy-generation";
import {
  EMAIL_COPY_FIELDS,
  FACEBOOK_COPY_FIELDS,
  INSTAGRAM_COPY_FIELDS,
  OUTREACH_PLATFORM_VALUES,
  type OutreachCopyField,
} from "@/lib/outreach-types";
import { requireAdminSession } from "@/lib/require-admin";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const ALL_COPY_FIELDS = [
  ...INSTAGRAM_COPY_FIELDS.map((f) => f.key),
  ...FACEBOOK_COPY_FIELDS.map((f) => f.key),
  ...EMAIL_COPY_FIELDS.map((f) => f.key),
] as const;

const bodySchema = z.object({
  platform: z.enum(OUTREACH_PLATFORM_VALUES),
  fields: z.array(z.enum(ALL_COPY_FIELDS as unknown as [string, ...string[]])).min(1).max(12),
  feedback: z.string().max(2000).optional(),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await ctx.params;
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    await hydratePlatformEnvFromDatabase();
    await ensureOutreachHubSchema();
    const copy = await generateOutreachLeadCopy({
      platform: parsed.data.platform,
      leadId: id,
      fields: parsed.data.fields as OutreachCopyField[],
      adminId: sess.adminId,
      feedback: parsed.data.feedback,
    });
    return NextResponse.json({ copy });
  } catch (e) {
    console.error("[outreach generate-copy]", e);
    return NextResponse.json(
      { error: formatUserFacingError(e, "Could not generate outreach copy.") },
      { status: 500 },
    );
  }
}
