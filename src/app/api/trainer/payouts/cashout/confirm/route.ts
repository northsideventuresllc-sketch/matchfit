import { verifyOtp } from "@/lib/otp";
import { hydrateStripeEnvFromDatabase } from "@/lib/hydrate-stripe-env";
import { prisma } from "@/lib/prisma";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";
import { getSessionTrainerId } from "@/lib/session";
import { requestTrainerPayout, type TrainerPayoutMethod } from "@/lib/trainer-payouts";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  amountCents: z.number().int().positive(),
  method: z.enum(["INSTANT", "STANDARD"]),
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code from your email."),
});

/** Step 2: verify the emailed code, then actually move the money. */
export async function POST(req: Request) {
  try {
    await hydrateStripeEnvFromDatabase();
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
    }
    const { amountCents, method, code } = parsed.data as {
      amountCents: number;
      method: TrainerPayoutMethod;
      code: string;
    };

    const trainer = await prisma.trainer.findUnique({
      where: { id: trainerId },
      select: { cashoutOtpHash: true, cashoutOtpExpires: true },
    });
    if (!trainer) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { cashoutOtpHash: hash, cashoutOtpExpires: exp } = trainer;
    if (!hash || !exp || exp.getTime() < Date.now()) {
      return NextResponse.json({ error: "Code expired or not requested. Request a new code." }, { status: 400 });
    }
    if (!verifyOtp(code, hash)) {
      return NextResponse.json({ error: "Incorrect code." }, { status: 400 });
    }

    await prisma.trainer.update({
      where: { id: trainerId },
      data: { cashoutOtpHash: null, cashoutOtpExpires: null },
    });

    const result = await requestTrainerPayout({ trainerId, amountCents, method });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ ok: true, netCents: result.netCents, feeCents: result.feeCents });
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Could not complete cash out.", {
      logLabel: "[trainer payouts cashout confirm]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
