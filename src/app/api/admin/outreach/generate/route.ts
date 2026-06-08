import { NextResponse } from "next/server";
import { z } from "zod";
import { generateOutreachLeads } from "@/lib/outreach-ai";
import { requireAdminSession } from "@/lib/require-admin";

const bodySchema = z.object({
  platform: z.enum(["instagram", "facebook", "email", "other"]),
  atlCount: z.number().int().min(0).max(20).default(5),
  virtualCount: z.number().int().min(0).max(20).default(10),
});

export async function POST(req: Request) {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (parsed.data.atlCount + parsed.data.virtualCount === 0) {
    return NextResponse.json({ error: "Set at least one lead count." }, { status: 400 });
  }

  try {
    const result = await generateOutreachLeads({
      platform: parsed.data.platform,
      atlCount: parsed.data.atlCount,
      virtualCount: parsed.data.virtualCount,
      adminId: sess.adminId,
    });
    return NextResponse.json(result);
  } catch (e) {
    console.error("[outreach generate]", e);
    return NextResponse.json({ error: "Lead generation failed." }, { status: 500 });
  }
}
