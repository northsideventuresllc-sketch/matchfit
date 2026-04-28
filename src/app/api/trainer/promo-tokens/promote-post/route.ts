import { NextResponse } from "next/server";
import { z } from "zod";
import { createVideoPromotion } from "@/lib/trainer-promo-tokens";
import { getSessionTrainerId } from "@/lib/session";
import { isTrainerPremiumStudioActive } from "@/lib/trainer-premium-studio";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  postId: z.string().min(1),
  durationDays: z.number().int().min(1).max(30),
  tokensBudget: z.number().int().min(20).max(20_000),
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
    const res = await createVideoPromotion({
      trainerId,
      postId: parsed.data.postId,
      durationDays: parsed.data.durationDays,
      tokensBudget: parsed.data.tokensBudget,
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
