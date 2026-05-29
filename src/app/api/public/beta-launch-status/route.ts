import { NextResponse } from "next/server";
import { getLaunchPromoStats } from "@/lib/launch-promo-stats";

export const dynamic = "force-dynamic";

export async function GET() {
  const stats = await getLaunchPromoStats();

  if (!stats.gatesEnabled) {
    return NextResponse.json({
      gatesEnabled: false,
      trainerCap: null,
      clientCap: null,
      trainerCount: null,
      clientCount: null,
      trainerSlotsUsed: null,
      clientSlotsUsed: null,
      trainerSlotsRemaining: null,
      clientSlotsRemaining: null,
      trainerFoundingMax: null,
      clientFoundingMax: null,
      trainerFoundingRemaining: null,
      clientFoundingRemaining: null,
      trainerTotalCapFull: false,
      trainerWaitlistOpen: false,
      clientWaitlistOpen: false,
      inPersonOfferingAvailable: true,
      trainerVirtualSlotsUsed: null,
      trainerVirtualSlotsMax: null,
      trainerVirtualSlotsRemaining: null,
      trainerVirtualCapFull: false,
      trainerInPersonSlotsUsed: null,
      trainerInPersonSlotsMax: null,
      trainerInPersonSlotsRemaining: null,
      trainerInPersonCapFull: false,
      trainerVirtualBaseMax: null,
    });
  }

  return NextResponse.json({
    gatesEnabled: true,
    trainerCap: stats.trainerBetaCap,
    clientCap: stats.clientBetaCap,
    trainerCount: stats.trainerCount,
    clientCount: stats.clientCount,
    trainerSlotsUsed: stats.trainerBetaSlotsUsed,
    clientSlotsUsed: stats.clientBetaSlotsUsed,
    trainerSlotsRemaining: stats.trainerBetaSlotsRemaining,
    clientSlotsRemaining: stats.clientBetaSlotsRemaining,
    trainerFoundingMax: stats.trainerFoundingMax,
    clientFoundingMax: stats.clientFoundingMax,
    trainerFoundingRemaining: stats.trainerFoundingRemaining,
    clientFoundingRemaining: stats.clientFoundingRemaining,
    trainerTotalCapFull: stats.trainerTotalCapFull,
    trainerWaitlistOpen: stats.trainerWaitlistOpen,
    clientWaitlistOpen: stats.clientWaitlistOpen,
    inPersonOfferingAvailable: stats.inPersonOfferingAvailable,
    trainerVirtualSlotsUsed: stats.trainerVirtualSlotsUsed,
    trainerVirtualSlotsMax: stats.trainerVirtualSlotsMax,
    trainerVirtualSlotsRemaining: stats.trainerVirtualSlotsRemaining,
    trainerVirtualCapFull: stats.trainerVirtualCapFull,
    trainerInPersonSlotsUsed: stats.trainerInPersonSlotsUsed,
    trainerInPersonSlotsMax: stats.trainerInPersonSlotsMax,
    trainerInPersonSlotsRemaining: stats.trainerInPersonSlotsRemaining,
    trainerInPersonCapFull: stats.trainerInPersonCapFull,
    trainerVirtualBaseMax: stats.trainerVirtualBaseMax,
  });
}
