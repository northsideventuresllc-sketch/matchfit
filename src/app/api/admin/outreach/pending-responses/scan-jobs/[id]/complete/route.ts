import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureOutreachHubSchema } from "@/lib/ensure-outreach-hub-schema";
import { hydratePlatformEnvFromDatabase } from "@/lib/hydrate-platform-env";
import { completeOutreachInstagramScanJob } from "@/lib/outreach-instagram-scan";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** The external Cowork scan session posts back with the shared CRON_SECRET (no admin cookie). */
function authorize(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  const q = new URL(req.url).searchParams.get("secret");
  return q === secret;
}

const bodySchema = z.union([
  z.object({
    replies: z
      .array(
        z.object({
          leadId: z.string().min(1),
          handle: z.string().max(200).optional(),
          preview: z.string().max(2000).optional(),
        }),
      )
      .max(200),
  }),
  z.object({ error: z.string().min(1).max(2000) }),
]);

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!authorize(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid scan completion payload." }, { status: 400 });
  }
  const { id } = await ctx.params;

  try {
    await hydratePlatformEnvFromDatabase();
    await ensureOutreachHubSchema();
    const body = parsed.data;
    const result = await completeOutreachInstagramScanJob({
      jobId: id,
      adminId: "cowork-scan",
      replies: "replies" in body ? body.replies : undefined,
      error: "error" in body ? body.error : undefined,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("[outreach scan-job complete]", e);
    const notFound = e instanceof Error && e.message === "Scan job not found.";
    return NextResponse.json(
      { error: notFound ? e.message : "Could not complete scan job." },
      { status: notFound ? 404 : 500 },
    );
  }
}
