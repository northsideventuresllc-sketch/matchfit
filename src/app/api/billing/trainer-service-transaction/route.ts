import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { recordTrainerServiceTransactionAndReward } from "@/lib/trainer-promo-tokens";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  clientUsername: z.string().min(1),
  trainerUsername: z.string().min(1),
  amountCents: z.number().int().min(0).max(1_000_000_000),
  idempotencyKey: z.string().min(8).max(200),
});

/**
 * Staff / automation hook to record a completed trainer service charge so sale-token
 * rewards and client tipping eligibility apply. Guard with a long random secret in production.
 */
export async function POST(req: Request) {
  const secret = process.env.MATCH_FIT_STAFF_BILLING_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "Not configured." }, { status: 503 });
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    const json = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
    }
    const { clientUsername, trainerUsername, amountCents, idempotencyKey } = parsed.data;
    const client = await prisma.client.findUnique({
      where: { username: clientUsername.trim() },
      select: { id: true },
    });
    const trainer = await prisma.trainer.findUnique({
      where: { username: trainerUsername.trim() },
      select: { id: true },
    });
    if (!client || !trainer) {
      return NextResponse.json({ error: "Client or trainer not found." }, { status: 404 });
    }
    const res = await recordTrainerServiceTransactionAndReward({
      clientId: client.id,
      trainerId: trainer.id,
      amountCents,
      idempotencyKey,
      source: "STAFF_IMPORT",
    });
    if ("error" in res) {
      return NextResponse.json({ error: "Duplicate idempotency key." }, { status: 409 });
    }
    return NextResponse.json({
      transactionId: res.transactionId,
      duplicate: res.duplicate ?? false,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not record transaction." }, { status: 500 });
  }
}
