import { prisma } from "@/lib/prisma";
import { getSessionClientId } from "@/lib/session";
import { NextResponse } from "next/server";

/** Lightweight client identity for shell UI. Do not add private address or billing-only fields here. */
export async function GET() {
  try {
    const clientId = await getSessionClientId();
    if (!clientId) {
      return NextResponse.json({ client: null });
    }
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: {
        id: true,
        preferredName: true,
        email: true,
        username: true,
        twoFactorEnabled: true,
        twoFactorMethod: true,
        profileImageUrl: true,
        bio: true,
      },
    });
    if (!client) {
      return NextResponse.json({ client: null });
    }
    return NextResponse.json({ client });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not load profile." }, { status: 500 });
  }
}
