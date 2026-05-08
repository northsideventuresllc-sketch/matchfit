import { trainerRequestDiyExtension } from "@/lib/diy-governance";
import { getSessionTrainerId } from "@/lib/session";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  hoursRequested: z.number().finite().positive(),
});

type Ctx = { params: Promise<{ clientUsername: string }> };

export async function POST(req: Request, ctx: Ctx) {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "hoursRequested is required." }, { status: 400 });

    const { clientUsername } = await ctx.params;
    const res = await trainerRequestDiyExtension({
      trainerId,
      clientUsername: decodeURIComponent(clientUsername).trim(),
      hoursRequested: parsed.data.hoursRequested,
    });
    if ("error" in res) return NextResponse.json({ error: res.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not request extension." }, { status: 500 });
  }
}
