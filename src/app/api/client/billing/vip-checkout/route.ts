import { createVipCheckoutSession } from "@/lib/client-vip-subscription";
import { getAppOriginFromRequest } from "@/lib/app-origin";
import { getSessionClientId } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const clientId = await getSessionClientId();
    if (!clientId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { email: true, vipSubscriptionActive: true },
    });
    if (!client) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    if (client.vipSubscriptionActive) {
      return NextResponse.json({ error: "You already have an active VIP membership." }, { status: 400 });
    }

    const origin = getAppOriginFromRequest(req);
    const result = await createVipCheckoutSession(
      clientId,
      client.email,
      `${origin}/client/dashboard/billing?vip=success`,
      `${origin}/client/dashboard/billing?vip=cancel`,
    );
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 503 });
    }

    return NextResponse.json({ url: result.url });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not start VIP checkout." }, { status: 500 });
  }
}
