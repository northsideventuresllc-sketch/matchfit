import { createVipCheckoutSession } from "@/lib/client-vip-subscription";
import { prisma } from "@/lib/prisma";
import { getSessionClientId } from "@/lib/session";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function getAppOrigin(req: Request): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  return new URL(req.url).origin;
}

export async function POST(req: Request) {
  try {
    const clientId = await getSessionClientId();
    if (!clientId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { email: true, deidentifiedAt: true },
    });
    if (!client || client.deidentifiedAt) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const origin = getAppOrigin(req);
    const result = await createVipCheckoutSession(
      clientId,
      client.email,
      `${origin}/client/dashboard/billing?vip=1`,
      `${origin}/client/dashboard/billing?canceled=1`,
    );
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 503 });
    }
    return NextResponse.json({ url: result.url });
  } catch (e) {
    console.error("[client vip checkout]", e);
    return NextResponse.json({ error: "Could not start VIP checkout." }, { status: 500 });
  }
}
