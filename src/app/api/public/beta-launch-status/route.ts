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

  // A count query can fail mid-request (transient DB/pooler blip — see launch-promo-stats.ts) and
  // fall back to a placeholder 0. Null out anything derived from an unavailable count instead of
  // handing out a fake number as if it were real — the home page banner and /promos already treat
  // `null` as "unknown, don't show a specific count" rather than as a real zero.
  return NextResponse.json({
    gatesEnabled: true,
    trainerCap: stats.trainerBetaCap,
    clientCap: stats.clientBetaCap,
    trainerCount: stats.trainerCountAvailable ? stats.trainerCount : null,
    clientCount: stats.clientCountAvailable ? stats.clientCount : null,
    trainerSlotsUsed: stats.trainerBetaSlotsAvailable ? stats.trainerBetaSlotsUsed : null,
    clientSlotsUsed: stats.clientBetaSlotsAvailable ? stats.clientBetaSlotsUsed : null,
    trainerSlotsRemaining: stats.trainerBetaSlotsAvailable ? stats.trainerBetaSlotsRemaining : null,
    clientSlotsRemaining: stats.clientBetaSlotsAvailable ? stats.clientBetaSlotsRemaining : null,
    trainerFoundingMax: stats.trainerFoundingMax,
    clientFoundingMax: stats.clientFoundingMax,
    trainerFoundingRemaining: stats.trainerCountAvailable ? stats.trainerFoundingRemaining : null,
    clientFoundingRemaining: stats.clientCountAvailable ? stats.clientFoundingRemaining : null,
    // Fail open on a failed count — better to under-warn "spots full" than block a real signup.
    trainerWaitlistOpen: stats.trainerBetaSlotsAvailable && stats.trainerWaitlistOpen,
    clientWaitlistOpen: stats.clientBetaSlotsAvailable && stats.clientWaitlistOpen,
  });
}
