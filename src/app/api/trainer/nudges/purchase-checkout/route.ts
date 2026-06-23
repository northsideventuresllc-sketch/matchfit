import { NextResponse } from "next/server";
import { createFpNudgePackCheckoutSession } from "@/lib/fp-nudge-pack-checkout";
import { appBaseUrlForEmail } from "@/lib/match-fit-email-shell";
import { resolveTrainerFpAccountTier } from "@/lib/fp-tier-chat-policy";
import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST() {
  const trainerId = await getSessionTrainerId();
  if (!trainerId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const trainer = await prisma.trainer.findUnique({
    where: { id: trainerId },
    select: {
      email: true,
      profile: { select: { accountTier: true } },
    },
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

  const origin = appBaseUrlForEmail();
  const checkout = await createFpNudgePackCheckoutSession(
    trainerId,
    trainer.email,
    `${origin}/trainer/dashboard/discover-clients?nudge_pack=success`,
    `${origin}/trainer/dashboard/discover-clients?nudge_pack=cancel`,
  );
  if ("error" in checkout) {
    return NextResponse.json({ error: checkout.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, checkoutUrl: checkout.url });
}
