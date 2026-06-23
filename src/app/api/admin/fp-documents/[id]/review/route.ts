import { NextResponse } from "next/server";
import { z } from "zod";
import { humanReviewFpDocument } from "@/lib/fp-document-review-service";
import { requireAdminSession } from "@/lib/require-admin";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  decision: z.enum(["approve", "deny"]),
  denialReason: z.string().max(2000).optional(),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid review request." }, { status: 400 });
  }

  const result = await humanReviewFpDocument({
    documentId: id,
    adminId: admin.adminId,
    decision: parsed.data.decision,
    denialReasonRaw: parsed.data.denialReason,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
