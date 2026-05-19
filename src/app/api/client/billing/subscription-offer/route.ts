import { NextResponse } from "next/server";
import { resolveClientSubscriptionBilling } from "@/lib/match-fit-launch-promotions";
import { getClientFoundingTrialDays, getClientPostCapTrialDays } from "@/lib/match-fit-launch-promotions";

export const dynamic = "force-dynamic";

export async function GET() {
  const offer = await resolveClientSubscriptionBilling({});
  return NextResponse.json({
    foundingSlot: offer.foundingSlot,
    trialDays: offer.trialDays,
    choice: offer.choice,
    requiresCardFirst: true,
    monthlyUsd: 10,
    foundingTrialDays: getClientFoundingTrialDays(),
    postCapTrialDays: getClientPostCapTrialDays(),
    allowPayNow: !offer.foundingSlot,
    allowTrial3d: !offer.foundingSlot,
  });
}
