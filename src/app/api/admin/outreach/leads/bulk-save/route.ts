import { NextResponse } from "next/server";
import { z } from "zod";
import { buildMassSaveOutreachWhere, massSaveOutreachLeadsToHub } from "@/lib/outreach-data";
import { leadProfileForPlatform } from "@/lib/outreach-lead-profile";
import { recordOutreachSavedToHubSignal } from "@/lib/outreach-learning";
import { OUTREACH_PLATFORM_VALUES, type OutreachPlatform } from "@/lib/outreach-types";
import { requireAdminSession } from "@/lib/require-admin";
import { prisma } from "@/lib/prisma";

const bulkSaveSchema = z.discriminatedUnion("mode", [
  z.object({
    platform: z.enum(OUTREACH_PLATFORM_VALUES),
    mode: z.literal("all"),
  }),
  z.object({
    platform: z.enum(OUTREACH_PLATFORM_VALUES),
    mode: z.literal("batch"),
    generationBatchId: z.string().trim().min(1).max(200),
  }),
  z.object({
    platform: z.enum(OUTREACH_PLATFORM_VALUES),
    mode: z.literal("ids"),
    ids: z.array(z.string().trim().min(1)).min(1).max(500),
  }),
]);

export async function POST(req: Request) {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const parsed = bulkSaveSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { platform, ...input } = parsed.data;
  const outreachPlatform = platform as OutreachPlatform;

  try {
    const where = { ...buildMassSaveOutreachWhere(input), savedToHubAt: null };
    if (outreachPlatform === "instagram") {
      const rows = await prisma.outreachInstagramLead.findMany({ where });
      for (const row of rows) {
        await recordOutreachSavedToHubSignal({
          platform: "instagram",
          leadId: row.id,
          adminId: sess.adminId,
          profile: leadProfileForPlatform("instagram", row),
        });
      }
    } else if (outreachPlatform === "facebook") {
      const rows = await prisma.outreachFacebookLead.findMany({ where });
      for (const row of rows) {
        await recordOutreachSavedToHubSignal({
          platform: "facebook",
          leadId: row.id,
          adminId: sess.adminId,
          profile: leadProfileForPlatform("facebook", row),
        });
      }
    } else if (outreachPlatform === "email") {
      const rows = await prisma.outreachEmailLead.findMany({ where });
      for (const row of rows) {
        await recordOutreachSavedToHubSignal({
          platform: "email",
          leadId: row.id,
          adminId: sess.adminId,
          profile: leadProfileForPlatform("email", row),
        });
      }
    }

    const { savedCount } = await massSaveOutreachLeadsToHub(outreachPlatform, input);
    return NextResponse.json({ ok: true, savedCount });
  } catch (e) {
    console.error("[outreach leads bulk-save]", e);
    return NextResponse.json({ error: "Could not save outreach leads to hub." }, { status: 500 });
  }
}
