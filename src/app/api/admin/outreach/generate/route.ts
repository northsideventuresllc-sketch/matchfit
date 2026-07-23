import { NextResponse } from "next/server";
import { z } from "zod";
import { formatUserFacingError } from "@/lib/read-json-response";
import { hydratePlatformEnvFromDatabase } from "@/lib/hydrate-platform-env";
import { ensureOutreachHubSchema } from "@/lib/ensure-outreach-hub-schema";
import { generateOutreachLeads } from "@/lib/outreach-ai";
import { fireOutreachAxonEvent } from "@/lib/outreach-axon-notify";
import { requireAdminSession } from "@/lib/require-admin";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const INSTAGRAM_MAX_LEADS_PER_RUN = 10;

import { OUTREACH_PLATFORM_VALUES } from "@/lib/outreach-types";

const bodySchema = z
  .object({
    platform: z.enum(OUTREACH_PLATFORM_VALUES),
    leadCount: z.number().int().min(0).max(20).optional(),
    atlCount: z.number().int().min(0).max(20).optional(),
    virtualCount: z.number().int().min(0).max(20).optional(),
  })
  .transform((data) => {
    const leadCount =
      data.leadCount ?? ((data.atlCount ?? 0) + (data.virtualCount ?? 0) || 8);
    return { platform: data.platform, leadCount };
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

  const { platform, leadCount } = parsed.data;

  if (leadCount === 0) {
    return NextResponse.json({ error: "Set a lead count of at least 1." }, { status: 400 });
  }

  if (platform === "instagram" && leadCount > INSTAGRAM_MAX_LEADS_PER_RUN) {
    return NextResponse.json(
      {
        error: `Instagram generation is limited to ${INSTAGRAM_MAX_LEADS_PER_RUN} leads per run to avoid server timeouts. Lower the count and generate again.`,
      },
      { status: 400 },
    );
  }

  try {
    await hydratePlatformEnvFromDatabase();
    await ensureOutreachHubSchema();
    const result = await generateOutreachLeads({
      platform,
      leadCount,
      adminId: sess.adminId,
    });

    // New Today's Leads ready — notify AXON so it can push them to Telegram for approve/delete/rewrite.
    if (result.leads.length > 0) {
      const leads = result.leads
        .map((raw) => {
          const r = raw as Record<string, unknown>;
          return {
            platform,
            leadId: String(r.id ?? ""),
            handle: String(r.handle ?? r.pageName ?? r.name ?? ""),
            contact: String(r.profileUrl ?? r.pageUrl ?? r.email ?? ""),
          };
        })
        .filter((l) => l.leadId);
      await fireOutreachAxonEvent({ eventType: "new_leads", leads, meta: { platform } });
    }

    return NextResponse.json(result);
  } catch (e) {
    console.error("[outreach generate]", e);
    const message = formatUserFacingError(e, "Lead generation failed.");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
