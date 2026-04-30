import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { TrainerFitHubFeedClient } from "@/components/trainer/trainer-fithub-feed-client";
import { getSessionTrainerId } from "@/lib/session";

export const metadata: Metadata = {
  title: "FitHub | Trainer | Match Fit",
};

export default async function TrainerFitHubPage() {
  const trainerId = await getSessionTrainerId();
  if (!trainerId) redirect("/trainer/dashboard/login");

  return (
    <div className="space-y-8">
      <header className="space-y-2 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FF7E00]/90">Trainer Social Feed</p>
        <h1 className="text-3xl font-black uppercase tracking-[0.06em] sm:text-4xl">FitHub</h1>
        <p className="mx-auto max-w-xl text-sm leading-relaxed text-white/50">
          Browse public trainer content across Match Fit. Premium controls for creating and scheduling your posts live in Premium Page.
        </p>
        <p className="text-xs text-white/40">
          <Link href="/trainer/dashboard/fit-hub-settings" className="text-[#FF7E00] underline-offset-2 hover:underline">
            FitHub Settings
          </Link>
        </p>
      </header>
      <TrainerFitHubFeedClient />
    </div>
  );
}
