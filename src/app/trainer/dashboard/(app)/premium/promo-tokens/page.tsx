import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { TrainerPromoTokensClient } from "./trainer-promo-tokens-client";

export const metadata: Metadata = {
  title: "Promotion tokens | Premium | Match Fit",
};

export default async function TrainerPromoTokensPage() {
  const trainerId = await getSessionTrainerId();
  if (!trainerId) redirect("/trainer/dashboard/login");

  const profile = await prisma.trainerProfile.findUnique({
    where: { trainerId },
    select: { premiumStudioEnabledAt: true },
  });
  if (!profile?.premiumStudioEnabledAt) {
    redirect("/trainer/dashboard/premium");
  }

  return <TrainerPromoTokensClient />;
}
