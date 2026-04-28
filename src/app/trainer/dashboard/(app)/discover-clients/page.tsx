import type { Metadata } from "next";
import { TrainerDiscoverClientsClient } from "@/components/trainer/trainer-discover-clients-client";

export const metadata: Metadata = {
  title: "Discover Clients | Trainer | Match Fit",
};

export default function TrainerDiscoverClientsPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FF7E00]/90">Matching</p>
        <h1 className="text-3xl font-black uppercase tracking-[0.06em] sm:text-4xl">Discover Clients</h1>
        <p className="mx-auto max-w-xl text-sm leading-relaxed text-white/50">
          Clients who opted into discovery and completed match preferences appear here. Send a nudge to start a
          conversation (free tier: 3 per day — see notice below).
        </p>
      </header>
      <TrainerDiscoverClientsClient />
    </div>
  );
}
