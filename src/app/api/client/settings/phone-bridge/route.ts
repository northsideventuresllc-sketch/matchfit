import { prisma } from "@/lib/prisma";
import { getSessionClientId } from "@/lib/session";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  allowPhoneBridge: z.boolean(),
});

export async function GET() {
  try {
    const clientId = await getSessionClientId();
    if (!clientId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const row = await prisma.client.findUnique({
      where: { id: clientId },
      select: { allowPhoneBridge: true, allowPhoneBridgeConsentAt: true, deidentifiedAt: true },
    });
    if (!row || row.deidentifiedAt) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    return NextResponse.json({
      allowPhoneBridge: row.allowPhoneBridge,
      allowPhoneBridgeConsentAt: row.allowPhoneBridgeConsentAt?.toISOString() ?? null,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not load phone settings." }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const clientId = await getSessionClientId();
    if (!clientId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }
    const cur = await prisma.client.findUnique({
      where: { id: clientId },
      select: { deidentifiedAt: true },
    });
    if (!cur || cur.deidentifiedAt) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const now = new Date();
    await prisma.client.update({
      where: { id: clientId },
      data: {
        allowPhoneBridge: parsed.data.allowPhoneBridge,
        allowPhoneBridgeConsentAt: parsed.data.allowPhoneBridge ? now : null,
      },
    });
    return NextResponse.json({ ok: true, allowPhoneBridge: parsed.data.allowPhoneBridge });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not update phone settings." }, { status: 500 });
  }
}
