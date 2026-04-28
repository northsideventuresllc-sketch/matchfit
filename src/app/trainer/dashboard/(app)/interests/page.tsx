import type { Metadata } from "next";
import { TrainerProfileInterestsClient } from "@/components/trainer/trainer-profile-interests-client";

export const metadata: Metadata = {
  title: "Inquiries | Trainer | Match Fit",
};

export default function TrainerInterestsPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FF7E00]/90">Inbox</p>
        <h1 className="text-3xl font-black uppercase tracking-[0.06em] sm:text-4xl">Profile inquiries</h1>
        <p className="mx-auto max-w-xl text-sm leading-relaxed text-white/50">
          Everyone who swiped or saved your profile while you were live on the platform. Accepting an inquiry opens the
          official chat thread with the relationship label defaulting to potential client.
        </p>
      </header>
      <TrainerProfileInterestsClient />
    </div>
  );
}
