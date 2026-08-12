import { NextResponse } from "next/server";
import { creditFpNudgePackFromCheckout } from "@/lib/fp-nudge-pack-checkout";
import { FP_NUDGE_PACK_PRICE_USD, FP_NUDGE_PACK_SIZE, resolveTrainerFpAccountTier } from "@/lib/fp-tier-chat-policy";
import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { debitTrainerWalletForPurchase } from "@/lib/trainer-wallet-purchase";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";

export const dynamic = "force-dynamic";

/** Same nudge pack as nudges/purchase-checkout, paid from the earnings wallet instead of Stripe. */
export async function POST() {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const trainer = await prisma.trainer.findUnique({
      where: { id: trainerId },
      select: { profile: { select: { accountTier: true } } },
    });
    if (!trainer?.profile) {
      return NextResponse.json({ error: "Profile not found." }, { status: 404 });
    }
    if (resolveTrainerFpAccountTier(trainer.profile.accountTier) !== "independent_fitness_pro") {
      return NextResponse.json(
        { error: "Extra nudge packs are available to Independent Fitness Pro accounts." },
        { status: 403 },
      );
    }

    const amountCents = Math.round(FP_NUDGE_PACK_PRICE_USD * 100);
    const debit = await debitTrainerWalletForPurchase({
      trainerId,
      amountCents,
      metaJson: JSON.stringify({ purpose: "fp_nudge_pack", packSize: FP_NUDGE_PACK_SIZE }),
    });
    if (!debit.ok) {
      return NextResponse.json({ error: debit.error }, { status: 400 });
    }

    await creditFpNudgePackFromCheckout(trainerId, FP_NUDGE_PACK_SIZE);

    return NextResponse.json({ ok: true, packSize: FP_NUDGE_PACK_SIZE });
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Could not complete wallet purchase.", {
      logLabel: "[trainer nudges purchase-wallet]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
