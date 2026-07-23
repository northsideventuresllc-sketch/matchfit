import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureOutreachHubSchema } from "@/lib/ensure-outreach-hub-schema";
import { completeOutreachDispatchBatch } from "@/lib/outreach-dispatch";
import { hasValidCoworkSecret } from "@/lib/require-cowork-secret";

export const dynamic = "force-dynamic";

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
  if (!(await hasValidCoworkSecret(req))) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

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
