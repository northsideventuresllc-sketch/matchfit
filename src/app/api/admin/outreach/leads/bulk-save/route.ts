import { NextResponse } from "next/server";
import { z } from "zod";
import { buildMassSaveOutreachWhere, massSaveOutreachLeadsToHub } from "@/lib/outreach-data";
import { leadProfileForPlatform } from "@/lib/outreach-lead-profile";
import { recordOutreachSavedToHubSignal } from "@/lib/outreach-learning";
import { mapWithConcurrency } from "@/lib/instagram-profile-verify";
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

    // Snapshot rows before save so learning signals still have full profiles.
    type SignalRow = { id: string; profile: ReturnType<typeof leadProfileForPlatform> };
    const signalRows: SignalRow[] = [];

    if (outreachPlatform === "instagram") {
      const rows = await prisma.outreachInstagramLead.findMany({ where });
      for (const row of rows) {
        signalRows.push({
          id: row.id,
          profile: leadProfileForPlatform("instagram", row),
        });
      }
    } else if (outreachPlatform === "facebook") {
      const rows = await prisma.outreachFacebookLead.findMany({ where });
      for (const row of rows) {
        signalRows.push({
          id: row.id,
          profile: leadProfileForPlatform("facebook", row),
        });
      }
    } else if (outreachPlatform === "email") {
      const rows = await prisma.outreachEmailLead.findMany({ where });
      for (const row of rows) {
        signalRows.push({
          id: row.id,
          profile: leadProfileForPlatform("email", row),
        });
      }
    }

    // Hub write first — email save-path drop previously happened when signals ran before persist.
    const { savedCount } = await massSaveOutreachLeadsToHub(outreachPlatform, input);

    // Fire signal writes with bounded concurrency instead of one-at-a-time — each row was
    // a sequential local insert plus two NI-Brain HTTP round trips, so up to 500 rows meant
    // up to 500 serial waits.
    await mapWithConcurrency(signalRows, 10, (row) =>
      recordOutreachSavedToHubSignal({
        platform: outreachPlatform,
        leadId: row.id,
        adminId: sess.adminId,
        profile: row.profile,
      }),
    );

    return NextResponse.json({ ok: true, savedCount });
  } catch (e) {
    console.error("[outreach leads bulk-save]", e);
    return NextResponse.json({ error: "Could not save outreach leads to hub." }, { status: 500 });
  }
}
