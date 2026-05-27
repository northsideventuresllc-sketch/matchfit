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
      trainerWaitlistOpen: false,
      clientWaitlistOpen: false,
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
    trainerWaitlistOpen: stats.trainerWaitlistOpen,
    clientWaitlistOpen: stats.clientWaitlistOpen,
  });
}
