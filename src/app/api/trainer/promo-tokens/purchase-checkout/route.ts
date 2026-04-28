import { NextResponse } from "next/server";
import { z } from "zod";
import { getAppOriginFromRequest } from "@/lib/app-origin";
import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { getStripe } from "@/lib/stripe-server";
import { isTrainerPremiumStudioActive } from "@/lib/trainer-premium-studio";
import { TOKENS_PER_USD_PACK, USD_PACK_PRICE_CENTS } from "@/lib/trainer-promo-tokens";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  packCount: z.number().int().min(1).max(40),
});

export async function POST(req: Request) {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    if (!(await isTrainerPremiumStudioActive(trainerId))) {
      return NextResponse.json({ error: "Premium Page is required to buy tokens." }, { status: 403 });
    }
    const trainer = await prisma.trainer.findUnique({
      where: { id: trainerId },
      select: { safetySuspended: true, email: true },
    });
    if (!trainer || trainer.safetySuspended) {
      return NextResponse.json({ error: "Unavailable." }, { status: 403 });
    }
    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json({ error: "Billing is not configured." }, { status: 503 });
    }
    const json = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
    }
    const { packCount } = parsed.data;
    const origin = getAppOriginFromRequest(req);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: trainer.email,
      line_items: [
        {
          quantity: packCount,
          price_data: {
            currency: "usd",
            unit_amount: USD_PACK_PRICE_CENTS,
            product_data: {
              name: `Match Fit promotion tokens (${TOKENS_PER_USD_PACK} per pack)`,
              description: `${TOKENS_PER_USD_PACK} tokens per $${(USD_PACK_PRICE_CENTS / 100).toFixed(2)} pack. Premium coaches only.`,
            },
          },
        },
      ],
      metadata: {
        purpose: "trainer_promo_tokens",
        trainerId,
        packCount: String(packCount),
      },
      success_url: `${origin}/trainer/dashboard/premium/promo-tokens?checkout=success`,
      cancel_url: `${origin}/trainer/dashboard/premium/promo-tokens?checkout=cancel`,
    });
    if (!session.url) {
      return NextResponse.json({ error: "Could not start checkout." }, { status: 500 });
    }
    return NextResponse.json({
      url: session.url,
      tokens: packCount * TOKENS_PER_USD_PACK,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not start checkout." }, { status: 500 });
  }
}
