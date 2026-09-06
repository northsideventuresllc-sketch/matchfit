import { NextResponse } from "next/server";
import { z } from "zod";
import { approveTrainerResumeSignupNudge, denyTrainerResumeSignupNudge } from "@/lib/trainer-resume-signup-nudge-cron";
import { requireAdminSession } from "@/lib/require-admin";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  decision: z.enum(["approve", "deny"]),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await ctx.params;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid nudge decision request." }, { status: 400 });
  }

  const result =
    parsed.data.decision === "approve"
      ? await approveTrainerResumeSignupNudge(id, admin.adminId)
      : await denyTrainerResumeSignupNudge(id, admin.adminId);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
