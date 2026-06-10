import { NextResponse } from "next/server";
import { z } from "zod";
import { massSoftDeleteOutreachLeads } from "@/lib/outreach-data";
import type { OutreachPlatform } from "@/lib/outreach-types";
import { requireAdminSession } from "@/lib/require-admin";

const bulkDeleteSchema = z.discriminatedUnion("mode", [
  z.object({
    platform: z.enum(["instagram", "facebook", "email", "other"]),
    mode: z.literal("all"),
  }),
  z.object({
    platform: z.enum(["instagram", "facebook", "email", "other"]),
    mode: z.literal("batch"),
    generationBatchId: z.string().trim().min(1).max(200),
  }),
  z.object({
    platform: z.enum(["instagram", "facebook", "email", "other"]),
    mode: z.literal("ids"),
    ids: z.array(z.string().trim().min(1)).min(1).max(500),
  }),
]);

export async function POST(req: Request) {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const parsed = bulkDeleteSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { platform, ...input } = parsed.data;

  try {
    const { deletedCount } = await massSoftDeleteOutreachLeads(platform as OutreachPlatform, input);
    return NextResponse.json({ ok: true, deletedCount });
  } catch (e) {
    console.error("[outreach leads bulk-delete]", e);
    return NextResponse.json({ error: "Could not delete outreach leads." }, { status: 500 });
  }
}
