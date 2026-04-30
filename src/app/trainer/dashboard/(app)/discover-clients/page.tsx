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
    select: { premiumStudioEnabledAt: true },
  });
  const isPremium = Boolean(profile?.premiumStudioEnabledAt);

  return (
    <div className="space-y-8">
      <header className="space-y-2 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FF7E00]/90">Matching</p>
        <h1 className="text-3xl font-black uppercase tracking-[0.06em] sm:text-4xl">Discover Clients</h1>
        <p className="mx-auto max-w-xl text-sm leading-relaxed text-white/50">
          Clients who opted into discovery and completed match preferences appear here. Send a nudge to start a
          conversation
          {isPremium ? (
            <>
              . With <span className="text-white/70">Match Fit Premium</span> on your account, discovery nudges are
              unlimited for everyone you see here who still accepts trainer discovery.
            </>
          ) : (
            <>
              {" "}
              (free tier: 3 per day — see notice below).
            </>
          )}
        </p>
      </header>
      <TrainerDiscoverClientsClient isPremium={isPremium} />
    </div>
  );
}
