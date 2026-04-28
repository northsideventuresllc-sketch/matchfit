import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { NextResponse } from "next/server";

/**
 * Trainer billing summary (placeholder until Stripe products for coaches ship).
 * Mirrors the shape expected by `TrainerBillingPageClient`.
 */
export async function GET() {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const trainer = await prisma.trainer.findUnique({
      where: { id: trainerId },
      select: {
        email: true,
        profile: {
          select: {
            premiumStudioEnabledAt: true,
          },
        },
      },
    });
    if (!trainer) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    return NextResponse.json({
      mode: "placeholder" as const,
      email: trainer.email,
      hasStripeCustomer: false,
      hasActiveSubscription: false,
      premiumStudioActive: Boolean(trainer.profile?.premiumStudioEnabledAt),
      premiumStudioEnabledAt: trainer.profile?.premiumStudioEnabledAt?.toISOString() ?? null,
      message:
        "Trainer billing (subscriptions, Premium Page fees, and payouts) will appear here when Stripe is connected for coaches. You can still review this page for future renewal dates and receipts.",
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not load billing summary." }, { status: 500 });
  }
}
