import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PremiumStudioLockedNotice } from "@/components/trainer/premium-studio-locked";
import { TrainerPremiumHubBackLink } from "@/components/trainer/trainer-premium-hub-summary";
import { isTrainerPremiumStudioActive } from "@/lib/trainer-premium-studio";
import { getSessionTrainerId } from "@/lib/session";
import { TrainerPromoTokensClient } from "./trainer-promo-tokens-client";

export const metadata: Metadata = {
  title: "Promotion tokens | Premium | Match Fit",
};

export default async function TrainerPromoTokensPage() {
  const trainerId = await getSessionTrainerId();
  if (!trainerId) redirect("/trainer/dashboard/login");

  const active = await isTrainerPremiumStudioActive(trainerId);

  if (!active) {
    return (
      <div className="space-y-8">
        <TrainerPremiumHubBackLink />
        <PremiumStudioLockedNotice areaLabel="Promotion Tokens" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <TrainerPremiumHubBackLink />
      <TrainerPromoTokensClient />
    </div>
  );
}
