import { NextResponse } from "next/server";
import { z } from "zod";
import { MAX_PROMO_DURATION_DAYS, MIN_PROMO_TOKENS_PER_DAY, MAX_SINGLE_PROMOTION_TOKENS, createVideoPromotion } from "@/lib/trainer-promo-tokens";
import { getSessionTrainerId } from "@/lib/session";
import { isTrainerPremiumStudioActive } from "@/lib/trainer-premium-studio";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  postId: z.string().min(1),
  durationDays: z.number().int().min(1).max(MAX_PROMO_DURATION_DAYS),
  tokensBudget: z.number().int().min(MIN_PROMO_TOKENS_PER_DAY).max(MAX_SINGLE_PROMOTION_TOKENS),
  /** ISO datetime; when set, promotion window starts at this instant (must be in the future). */
  scheduledStartsAt: z.string().optional().nullable(),
});

export async function POST(req: Request) {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    if (!(await isTrainerPremiumStudioActive(trainerId))) {
      return NextResponse.json({ error: "Premium Page is required." }, { status: 403 });
    }
    const json = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
    }
    let scheduled: Date | null = null;
    if (parsed.data.scheduledStartsAt?.trim()) {
      const d = new Date(parsed.data.scheduledStartsAt);
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ error: "Invalid scheduled start time." }, { status: 400 });
      }
      scheduled = d;
    }
    const res = await createVideoPromotion({
      trainerId,
      postId: parsed.data.postId,
      durationDays: parsed.data.durationDays,
      tokensBudget: parsed.data.tokensBudget,
      scheduledStartsAt: scheduled,
    });
    if ("error" in res) {
      return NextResponse.json({ error: res.error }, { status: 400 });
    }
    return NextResponse.json({ promotionId: res.promotionId });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not create promotion." }, { status: 500 });
  }
}
