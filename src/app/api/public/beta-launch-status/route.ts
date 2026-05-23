import { NextResponse } from "next/server";
import {
  clientBetaSlotsUsed,
  countClientsForBetaCap,
  countTrainersForBetaCap,
  isClientBetaCapReached,
  isTrainerBetaCapReached,
  trainerBetaSlotsUsed,
} from "@/lib/beta-waitlist-service";
import { betaMaxClients, betaMaxTrainers, isBetaLaunchGatesEnabled } from "@/lib/beta-launch-config";

export const dynamic = "force-dynamic";

export async function GET() {
  const gates = isBetaLaunchGatesEnabled();
  if (!gates) {
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
      trainerWaitlistOpen: false,
      clientWaitlistOpen: false,
    });
  }

  const trainerCap = betaMaxTrainers();
  const clientCap = betaMaxClients();

  const [trainerCount, clientCount, trainerUsed, clientUsed, tFull, cFull] = await Promise.all([
    countTrainersForBetaCap(),
    countClientsForBetaCap(),
    trainerBetaSlotsUsed(),
    clientBetaSlotsUsed(),
    isTrainerBetaCapReached(),
    isClientBetaCapReached(),
  ]);

  return NextResponse.json({
    gatesEnabled: true,
    trainerCap,
    clientCap,
    trainerCount,
    clientCount,
    trainerSlotsUsed: trainerUsed,
    clientSlotsUsed: clientUsed,
    trainerSlotsRemaining: Math.max(0, trainerCap - trainerUsed),
    clientSlotsRemaining: Math.max(0, clientCap - clientUsed),
    trainerWaitlistOpen: tFull,
    clientWaitlistOpen: cFull,
  });
}
