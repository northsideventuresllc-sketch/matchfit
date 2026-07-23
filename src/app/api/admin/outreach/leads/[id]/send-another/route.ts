import { NextResponse } from "next/server";
import { z } from "zod";
import { formatUserFacingError } from "@/lib/read-json-response";
import { ensureOutreachHubSchema } from "@/lib/ensure-outreach-hub-schema";
import { hydratePlatformEnvFromDatabase } from "@/lib/hydrate-platform-env";
import { generateOutreachLeadCopy } from "@/lib/outreach-copy-generation";
import { queueOutreachDispatch } from "@/lib/outreach-dispatch";
import { OUTREACH_PLATFORM_VALUES, type OutreachCopyField, type OutreachPlatform } from "@/lib/outreach-types";
import { requireAdminSession } from "@/lib/require-admin";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Platform passed in the body (see note in regenerate-response) — Next.js forbids a second dynamic
// slug name alongside the existing /leads/[id].
const bodySchema = z.object({
  platform: z.enum(OUTREACH_PLATFORM_VALUES),
  feedback: z.string().max(2000).optional(),
});

/** The main outbound copy field to regenerate per platform for "send another message". */
const SEND_FIELDS: Record<OutreachPlatform, OutreachCopyField[]> = {
  instagram: ["dmText"],
  facebook: ["pagePostText"],
  email: ["emailSubject", "emailBody"],
};

async function leadLane(platform: OutreachPlatform, id: string): Promise<string | null> {
  const select = { outreachLane: true };
  if (platform === "instagram") return (await prisma.outreachInstagramLead.findUnique({ where: { id }, select }))?.outreachLane ?? null;
  if (platform === "facebook") return (await prisma.outreachFacebookLead.findUnique({ where: { id }, select }))?.outreachLane ?? null;
  return (await prisma.outreachEmailLead.findUnique({ where: { id }, select }))?.outreachLane ?? null;
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await ctx.params;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const { platform, feedback } = parsed.data;

  try {
    await hydratePlatformEnvFromDatabase();
    await ensureOutreachHubSchema();

    const lane = await leadLane(platform, id);
    if (lane === null) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (lane !== "pending") {
      return NextResponse.json(
        { error: "Send another is only available for pending leads (no action needed)." },
        { status: 400 },
      );
    }

    const copy = await generateOutreachLeadCopy({
      platform,
      leadId: id,
      fields: SEND_FIELDS[platform],
      adminId: sess.adminId,
      feedback,
    });

    const dispatch = await queueOutreachDispatch({
      leads: [{ id, platform }],
      adminId: sess.adminId,
    });

    return NextResponse.json({ copy, dispatch });
  } catch (e) {
    console.error("[outreach send-another]", e);
    return NextResponse.json(
      { error: formatUserFacingError(e, "Could not queue another message.") },
      { status: 500 },
    );
  }
}
