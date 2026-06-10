import { NextResponse } from "next/server";
import { z } from "zod";
import { massSaveOutreachLeadsToHub } from "@/lib/outreach-data";
import type { OutreachPlatform } from "@/lib/outreach-types";
import { requireAdminSession } from "@/lib/require-admin";

const bulkSaveSchema = z.discriminatedUnion("mode", [
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

  const parsed = bulkSaveSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { platform, ...input } = parsed.data;

  try {
    const { savedCount } = await massSaveOutreachLeadsToHub(platform as OutreachPlatform, input);
    return NextResponse.json({ ok: true, savedCount });
  } catch (e) {
    console.error("[outreach leads bulk-save]", e);
    return NextResponse.json({ error: "Could not save outreach leads to hub." }, { status: 500 });
  }
}
