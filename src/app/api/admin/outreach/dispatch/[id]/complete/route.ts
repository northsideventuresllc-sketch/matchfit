import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureOutreachHubSchema } from "@/lib/ensure-outreach-hub-schema";
import { completeOutreachDispatchBatch } from "@/lib/outreach-dispatch";

export const dynamic = "force-dynamic";

/** The external Cowork session posts back with the shared CRON_SECRET (no admin cookie). */
function authorize(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  const q = new URL(req.url).searchParams.get("secret");
  return q === secret;
}

const bodySchema = z.object({
  results: z
    .array(
      z.object({
        leadId: z.string().min(1),
        status: z.enum(["sent", "failed"]),
        detail: z.string().max(2000).optional(),
      }),
    )
    .min(1)
    .max(200),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!authorize(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid dispatch completion payload." }, { status: 400 });
  }
  const { id } = await ctx.params;

  try {
    await ensureOutreachHubSchema();
    const result = await completeOutreachDispatchBatch({ batchId: id, results: parsed.data.results });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("[outreach dispatch complete]", e);
    const message = e instanceof Error && e.message === "Dispatch batch not found." ? e.message : "Could not complete dispatch batch.";
    const status = message === "Dispatch batch not found." ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
