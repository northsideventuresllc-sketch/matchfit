import { NextResponse } from "next/server";
import { z } from "zod";
import { formatUserFacingError } from "@/lib/read-json-response";
import { ensureOutreachHubSchema } from "@/lib/ensure-outreach-hub-schema";
import { hydratePlatformEnvFromDatabase } from "@/lib/hydrate-platform-env";
import { generateOutreachResponseDraft } from "@/lib/outreach-response-draft";
import { OUTREACH_PLATFORM_VALUES } from "@/lib/outreach-types";
import { requireAdminSession } from "@/lib/require-admin";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// NOTE: platform is passed in the body (not the path). Next.js forbids a second dynamic slug name
// (`[platform]`) alongside the existing `[id]` at the /leads level, so this stays under [id] and
// follows the established outreach convention of platform-in-body.
const bodySchema = z.object({
  platform: z.enum(OUTREACH_PLATFORM_VALUES),
  incomingMessage: z.string().max(4000).optional(),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await ctx.params;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  try {
    await hydratePlatformEnvFromDatabase();
    await ensureOutreachHubSchema();
    const draft = await generateOutreachResponseDraft({
      platform: parsed.data.platform,
      leadId: id,
      adminId: sess.adminId,
      incomingMessage: parsed.data.incomingMessage,
    });
    return NextResponse.json({ pendingResponseDraft: draft });
  } catch (e) {
    console.error("[outreach regenerate-response]", e);
    return NextResponse.json(
      { error: formatUserFacingError(e, "Could not regenerate response draft.") },
      { status: 500 },
    );
  }
}
