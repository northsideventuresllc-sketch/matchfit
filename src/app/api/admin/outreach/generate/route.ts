import { NextResponse } from "next/server";
import { z } from "zod";
import { hydratePlatformEnvFromDatabase } from "@/lib/hydrate-platform-env";
import { generateOutreachLeads } from "@/lib/outreach-ai";
import { requireAdminSession } from "@/lib/require-admin";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const INSTAGRAM_MAX_LEADS_PER_RUN = 10;

import { OUTREACH_PLATFORM_VALUES } from "@/lib/outreach-types";

const bodySchema = z.object({
  platform: z.enum(OUTREACH_PLATFORM_VALUES),
  atlCount: z.number().int().min(0).max(20).default(5),
  virtualCount: z.number().int().min(0).max(20).default(10),
});

export async function POST(req: Request) {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

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

  const totalLeads = parsed.data.atlCount + parsed.data.virtualCount;
  if (totalLeads === 0) {
    return NextResponse.json({ error: "Set at least one lead count." }, { status: 400 });
  }

  if (parsed.data.platform === "instagram" && totalLeads > INSTAGRAM_MAX_LEADS_PER_RUN) {
    return NextResponse.json(
      {
        error: `Instagram generation is limited to ${INSTAGRAM_MAX_LEADS_PER_RUN} leads per run to avoid server timeouts. Lower ATL + virtual counts and generate again.`,
      },
      { status: 400 },
    );
  }

  try {
    await hydratePlatformEnvFromDatabase();
    const result = await generateOutreachLeads({
      platform: parsed.data.platform,
      atlCount: parsed.data.atlCount,
      virtualCount: parsed.data.virtualCount,
      adminId: sess.adminId,
    });
    return NextResponse.json(result);
  } catch (e) {
    console.error("[outreach generate]", e);
    const message = e instanceof Error ? e.message : "Lead generation failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
