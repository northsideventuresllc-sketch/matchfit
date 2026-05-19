import { canReserveLaunchClientSlot } from "@/lib/match-fit-launch-cohort";
import { prisma } from "@/lib/prisma";
import { getRegistrationHoldPendingId } from "@/lib/session";
import { isMatchFitInternalQaClientEmail } from "@/lib/match-fit-internal-qa";
import { NextResponse } from "next/server";

function maskEmail(email: string): string {
  const [a, d] = email.split("@");
  if (!d) return "***";
  const head = a.length <= 2 ? `${a[0] ?? ""}*` : `${a.slice(0, 2)}…`;
  return `${head}@${d}`;
}

export async function GET() {
  try {
    const holdId = await getRegistrationHoldPendingId();
    if (!holdId) {
      return NextResponse.json({ hasHold: false, internalQaBillingSkipEligible: false });
    }
    const hold = await prisma.pendingClientRegistration.findUnique({
      where: { id: holdId },
      select: { id: true, email: true, status: true, expiresAt: true },
    });
    if (!hold || hold.expiresAt < new Date()) {
      return NextResponse.json({ hasHold: false, internalQaBillingSkipEligible: false });
    }
    const internalQaBillingSkipEligible =
      hold.status === "AWAITING_PAYMENT" && isMatchFitInternalQaClientEmail(hold.email);
    const launchCohortEligible = await canReserveLaunchClientSlot(hold.email);
    return NextResponse.json({
      hasHold: true,
      holdStatus: hold.status,
      emailMasked: maskEmail(hold.email),
      internalQaBillingSkipEligible,
      launchCohortEligible,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not load registration." }, { status: 500 });
  }
}
