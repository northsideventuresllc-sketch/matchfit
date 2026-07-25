import { NextResponse } from "next/server";
import { z } from "zod";
import { buildMassDeleteOutreachWhere, massSoftDeleteOutreachLeads } from "@/lib/outreach-data";
import { leadProfileForPlatform } from "@/lib/outreach-lead-profile";
import { recordOutreachDeleteReasonSignal } from "@/lib/outreach-learning";
import { mapWithConcurrency } from "@/lib/instagram-profile-verify";
import { OUTREACH_PLATFORM_VALUES, type OutreachPlatform } from "@/lib/outreach-types";
import { resolveOutreachActor } from "@/lib/require-service-token";
import { prisma } from "@/lib/prisma";

const bulkDeleteSchema = z.discriminatedUnion("mode", [
  z.object({
    platform: z.enum(OUTREACH_PLATFORM_VALUES),
    mode: z.literal("all"),
    deleteReason: z.string().trim().min(3).max(2000),
  }),
  z.object({
    platform: z.enum(OUTREACH_PLATFORM_VALUES),
    mode: z.literal("batch"),
    generationBatchId: z.string().trim().min(1).max(200),
    deleteReason: z.string().trim().min(3).max(2000),
  }),
  z.object({
    platform: z.enum(OUTREACH_PLATFORM_VALUES),
    mode: z.literal("ids"),
    ids: z.array(z.string().trim().min(1)).min(1).max(500),
    deleteReason: z.string().trim().min(3).max(2000),
  }),
]);

export async function POST(req: Request) {
  const actor = await resolveOutreachActor(req);
  if (!actor) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const parsed = bulkDeleteSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please provide a reason why these leads were deleted (at least 3 characters)." },
      { status: 400 },
    );
  }

  const { platform, deleteReason, ...input } = parsed.data;
  const outreachPlatform = platform as OutreachPlatform;

  try {
    // Signal writes run with bounded concurrency instead of one-at-a-time — each row was a
    // sequential local insert plus two NI-Brain HTTP round trips, so up to 500 rows meant up
    // to 500 serial waits before the actual delete even ran.
    const where = buildMassDeleteOutreachWhere(input);
    if (outreachPlatform === "instagram") {
      const rows = await prisma.outreachInstagramLead.findMany({ where });
      await mapWithConcurrency(rows, 10, (row) =>
        recordOutreachDeleteReasonSignal({
          platform: "instagram",
          leadId: row.id,
          adminId: actor.adminId,
          reason: deleteReason,
          profile: leadProfileForPlatform("instagram", row),
        }),
      );
    } else if (outreachPlatform === "facebook") {
      const rows = await prisma.outreachFacebookLead.findMany({ where });
      await mapWithConcurrency(rows, 10, (row) =>
        recordOutreachDeleteReasonSignal({
          platform: "facebook",
          leadId: row.id,
          adminId: actor.adminId,
          reason: deleteReason,
          profile: leadProfileForPlatform("facebook", row),
        }),
      );
    } else if (outreachPlatform === "email") {
      const rows = await prisma.outreachEmailLead.findMany({ where });
      await mapWithConcurrency(rows, 10, (row) =>
        recordOutreachDeleteReasonSignal({
          platform: "email",
          leadId: row.id,
          adminId: actor.adminId,
          reason: deleteReason,
          profile: leadProfileForPlatform("email", row),
        }),
      );
    }

    const { deletedCount } = await massSoftDeleteOutreachLeads(outreachPlatform, input);
    return NextResponse.json({ ok: true, deletedCount });
  } catch (e) {
    console.error("[outreach leads bulk-delete]", e);
    return NextResponse.json({ error: "Could not delete outreach leads." }, { status: 500 });
  }
}
