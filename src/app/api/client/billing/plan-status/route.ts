import { buildClientPlanStatus } from "@/lib/client-plan-status";
import { clientPlanAccessSelect } from "@/lib/client-plan-gate";
import { syncClientPlatformBillingLifecycle } from "@/lib/client-platform-lifecycle";
import { resolveClientPlatformAccessPhase } from "@/lib/client-platform-access";
import { getSessionClientId } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const clientId = await getSessionClientId();
    if (!clientId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    await syncClientPlatformBillingLifecycle(clientId);

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: {
        ...clientPlanAccessSelect,
        platformTrialConsumed: true,
        stripeSubscriptionId: true,
        stripeSubscriptionActive: true,
        subscriptionGraceUntil: true,
        paymentGraceUntil: true,
        accountDeactivatedAt: true,
      },
    });
    if (!client) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const plan = buildClientPlanStatus(client);
    const accessPhase = resolveClientPlatformAccessPhase({
      stripeSubscriptionId: client.stripeSubscriptionId,
      stripeSubscriptionActive: client.stripeSubscriptionActive,
      subscriptionGraceUntil: client.subscriptionGraceUntil,
      platformTrialEndsAt: client.platformTrialEndsAt,
      paymentGraceUntil: client.paymentGraceUntil,
      accountDeactivatedAt: client.accountDeactivatedAt,
      platformTrialConsumed: client.platformTrialConsumed,
      vipSubscriptionActive: client.vipSubscriptionActive,
      clientPlanTier: client.clientPlanTier,
    });

    return NextResponse.json({ ...plan, accessPhase });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not load plan status." }, { status: 500 });
  }
}
