import { clientPostDueAttestDiy } from "@/lib/diy-governance";
import { getSessionClientId } from "@/lib/session";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  engagementId: z.string().min(1),
  received: z.boolean(),
});

export async function POST(req: Request) {
  try {
    const clientId = await getSessionClientId();
    if (!clientId) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

    const res = await clientPostDueAttestDiy({
      clientId,
      engagementId: parsed.data.engagementId,
      received: parsed.data.received,
    });
    if ("error" in res) return NextResponse.json({ error: res.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not save attestation." }, { status: 500 });
  }
}
