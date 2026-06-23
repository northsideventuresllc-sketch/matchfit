import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TrainerDiscoverClientsClient } from "@/components/trainer/trainer-discover-clients-client";
import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";

export const metadata: Metadata = {
  title: "Discover Clients | Trainer | Match Fit",
};

export default async function TrainerDiscoverClientsPage() {
  const trainerId = await getSessionTrainerId();
  if (!trainerId) redirect("/trainer/dashboard/login");

  const profile = await prisma.trainerProfile.findUnique({
    where: { trainerId },
    select: { premiumStudioEnabledAt: true, accountTier: true },
  });
  const isPremium = Boolean(profile?.premiumStudioEnabledAt);
  const tier = profile?.accountTier;
  const isFpProTier = tier === "match_fit_pro" || tier === "match_fit_premium_pro";

  return (
    <div className="space-y-8">
      <header className="space-y-2 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FF7E00]/90">Matching</p>
        <h1 className="text-3xl font-black uppercase tracking-[0.06em] sm:text-4xl">Discover Clients</h1>
        <p className="mx-auto max-w-xl text-sm leading-relaxed text-white/50">
          {isFpProTier ? (
            <>
              Match Fit Pro and Match Fit Premium Pro accounts use in-app chat for client outreach. Discovery nudges are
              not part of those tiers — use Chats or Inquiries after a client connects with you.
            </>
          ) : tier === "independent_fitness_pro" ? (
            <>
              Clients who opted into discovery appear here. Send a discovery nudge to get their attention — Independent
              Fitness Pro accounts do not include in-app chat. See the notice below for daily limits and optional nudge
              packs.
            </>
          ) : (
            <>
              Clients who opted into discovery and completed match preferences appear here. Send a nudge to start a
              conversation when your account type includes discovery nudges.
            </>
          )}
        </p>
      </header>
      <TrainerDiscoverClientsClient isPremium={isPremium} />
    </div>
  );
}
