import { NextResponse } from "next/server";
import { z } from "zod";
import { isNiBrainConfiguredAsync, recordContentLearning } from "@/lib/ni-brain-client";
import { requireAdminSession } from "@/lib/require-admin";

const bodySchema = z.object({
  feedback: z.string().trim().min(1).max(4000),
});

/**
 * Backs the day-feedback page's submit button. Writes free-text feedback into
 * match_fit_content_learning_signals via recordContentLearning() — the same table
 * recordDayApprovalMemo() writes to for the (separate) day-approval flow. There is no dedicated
 * "day feedback" entry in recordContentLearning's signalType union, so this reuses
 * "DAY_APPROVAL_MEMO" (the only day-level, postDate-scoped type available) and disambiguates via
 * meta.kind — it deliberately omits meta.status so cancelDayApprovalMemo's
 * `meta_json->>status = 'pending'` filter never matches these rows and can't delete them.
 */
export async function POST(req: Request, ctx: { params: Promise<{ date: string }> }) {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { date } = await ctx.params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Invalid date." }, { status: 400 });
  }

  if (!(await isNiBrainConfiguredAsync())) {
    return NextResponse.json({ error: "NI Brain is not configured." }, { status: 503 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Write some feedback before submitting." }, { status: 400 });
  }

  try {
    await recordContentLearning({
      signalType: "DAY_APPROVAL_MEMO",
      editedText: parsed.data.feedback,
      meta: {
        postDate: date,
        kind: "day_feedback",
        source: "day_feedback_page",
        submittedBy: sess.adminId,
        submittedAt: new Date().toISOString(),
      },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[day-feedback]", e);
    return NextResponse.json({ error: "Could not save feedback." }, { status: 500 });
  }
}
