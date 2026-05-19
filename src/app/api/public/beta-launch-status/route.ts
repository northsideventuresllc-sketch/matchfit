import { NextResponse } from "next/server";
import {
  countClientsForBetaCap,
  countTrainersForBetaCap,
  isClientBetaCapReached,
  isTrainerBetaCapReached,
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
      trainerWaitlistOpen: false,
      clientWaitlistOpen: false,
    });
  }
  const [tc, cc, tFull, cFull] = await Promise.all([
    countTrainersForBetaCap(),
    countClientsForBetaCap(),
    isTrainerBetaCapReached(),
    isClientBetaCapReached(),
  ]);
  return NextResponse.json({
    gatesEnabled: true,
    trainerCap: betaMaxTrainers(),
    clientCap: betaMaxClients(),
    trainerCount: tc,
    clientCount: cc,
    trainerWaitlistOpen: tFull,
    clientWaitlistOpen: cFull,
  });
}
