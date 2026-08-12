import { generateSixDigitCode, hashOtp } from "@/lib/otp";
import { hydrateStripeEnvFromDatabase } from "@/lib/hydrate-stripe-env";
import { prisma } from "@/lib/prisma";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";
import { getSessionTrainerId } from "@/lib/session";
import { sendTransactionalEmailIfAllowed } from "@/lib/transactional-email-send";
import { computePayoutFeeCents, validatePayoutAmountCents, type TrainerPayoutMethod } from "@/lib/trainer-payouts";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  amountCents: z.number().int().positive(),
  method: z.enum(["INSTANT", "STANDARD"]),
});

/** Step 1 of a cash-out: validate the request, then email a verification code. Nothing moves yet. */
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
    const { amountCents, method } = parsed.data as { amountCents: number; method: TrainerPayoutMethod };

    const trainer = await prisma.trainer.findUnique({
      where: { id: trainerId },
      select: {
        email: true,
        stripeConnectPayoutsEnabled: true,
        earningsBalance: { select: { balanceCents: true } },
      },
    });
    if (!trainer) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    if (!trainer.stripeConnectPayoutsEnabled) {
      return NextResponse.json({ error: "Connect a bank account before cashing out." }, { status: 400 });
    }
    const amountError = validatePayoutAmountCents(amountCents, trainer.earningsBalance?.balanceCents ?? 0);
    if (amountError) {
      return NextResponse.json({ error: amountError }, { status: 400 });
    }

    const code = generateSixDigitCode();
    await prisma.trainer.update({
      where: { id: trainerId },
      data: {
        cashoutOtpHash: hashOtp(code),
        cashoutOtpExpires: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    await sendTransactionalEmailIfAllowed({
      kind: "CASHOUT_OTP",
      to: trainer.email,
      audience: "TRAINER",
      trainerId,
      variables: { code },
    });

    const feeCents = computePayoutFeeCents(method);
    return NextResponse.json({ ok: true, feeCents, netCents: amountCents - feeCents });
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Could not start cash out.", {
      logLabel: "[trainer payouts cashout start]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
