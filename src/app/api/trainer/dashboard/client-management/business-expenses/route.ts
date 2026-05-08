import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  amountDollars: z.number().finite().positive().max(100_000),
  spentAt: z.string().datetime(),
  category: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  likelyTaxDeductible: z.boolean().optional(),
});

export async function POST(req: Request) {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid body." }, { status: 400 });

    const spentAt = new Date(parsed.data.spentAt);
    if (Number.isNaN(spentAt.getTime())) return NextResponse.json({ error: "Invalid spentAt." }, { status: 400 });

    const amountCents = Math.round(parsed.data.amountDollars * 100);
    await prisma.trainerBusinessExpense.create({
      data: {
        trainerId,
        spentAt,
        amountCents,
        category: parsed.data.category.trim(),
        description: parsed.data.description?.trim() ?? null,
        likelyTaxDeductible: parsed.data.likelyTaxDeductible ?? true,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not save expense." }, { status: 500 });
  }
}
