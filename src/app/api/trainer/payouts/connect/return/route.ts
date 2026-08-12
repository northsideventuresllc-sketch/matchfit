import { getAppOriginFromRequest } from "@/lib/app-origin";
import { hydrateStripeEnvFromDatabase } from "@/lib/hydrate-stripe-env";
import { getSessionTrainerId } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { syncTrainerConnectAccountStatus } from "@/lib/stripe-connect";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Stripe redirects the trainer here after leaving the onboarding flow (finished or not). */
export async function GET(req: Request) {
  const origin = getAppOriginFromRequest(req);
  const billingUrl = `${origin}/trainer/dashboard/billing?connect=return`;

  try {
    await hydrateStripeEnvFromDatabase();
    const trainerId = await getSessionTrainerId();
    if (!trainerId) return NextResponse.redirect(billingUrl);

    const trainer = await prisma.trainer.findUnique({
      where: { id: trainerId },
      select: { stripeConnectAccountId: true },
    });
    if (trainer?.stripeConnectAccountId) {
      await syncTrainerConnectAccountStatus(trainer.stripeConnectAccountId);
    }
  } catch (e) {
    console.error("[trainer payouts connect return] sync failed:", e);
  }

  return NextResponse.redirect(billingUrl);
}
