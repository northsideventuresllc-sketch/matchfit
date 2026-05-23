import { NextResponse } from "next/server";
import { countLaunchClients } from "@/lib/launch-account-counts";
import {
  getClientFoundingTrialDays,
  getClientFoundingTrialMaxClients,
  getClientPostCapTrialDays,
  resolveClientSubscriptionBilling,
} from "@/lib/match-fit-launch-promotions";

export const dynamic = "force-dynamic";

export async function GET() {
  const [offer, launchClientCount] = await Promise.all([
    resolveClientSubscriptionBilling({}),
    countLaunchClients(),
  ]);
  const foundingCap = getClientFoundingTrialMaxClients();
  return NextResponse.json({
    foundingSlot: offer.foundingSlot,
    trialDays: offer.trialDays,
    choice: offer.choice,
    requiresCardFirst: true,
    monthlyUsd: 10,
    foundingTrialDays: getClientFoundingTrialDays(),
    postCapTrialDays: getClientPostCapTrialDays(),
    foundingCap,
    launchClientCount,
    foundingSlotsRemaining: Math.max(0, foundingCap - launchClientCount),
    allowPayNow: !offer.foundingSlot,
    allowTrial3d: !offer.foundingSlot,
  });
}
