import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { TrainerPremiumStudioClient } from "./trainer-premium-studio-client";

export const metadata: Metadata = {
  title: "Premium Studio | Trainer | Match Fit",
};

export default async function TrainerPremiumStudioPage() {
  const trainerId = await getSessionTrainerId();
  if (!trainerId) redirect("/trainer/dashboard/login");

  const profile = await prisma.trainerProfile.findUnique({
    where: { trainerId },
    select: { premiumStudioEnabledAt: true },
  });
  if (!profile?.premiumStudioEnabledAt) {
    redirect("/trainer/dashboard/premium");
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FF7E00]/90">Premium Studio</p>
          <h1 className="mt-1 text-2xl font-black tracking-[0.04em] sm:text-3xl">Create for FitHub</h1>
          <p className="mt-2 max-w-xl text-sm text-white/50">
            Upload media or write a check-in, add captions and hashtags, then post to FitHub now or schedule up to one year ahead.
            Hashtags help surface your posts to clients whose match interests overlap with your tags.
          </p>
        </div>
        <Link
          href="/trainer/dashboard/premium/my-content"
          className="text-xs font-black uppercase tracking-[0.14em] text-[#FF7E00] underline-offset-2 hover:underline"
        >
          MY CONTENT
        </Link>
      </header>

      <TrainerPremiumStudioClient />
    </div>
  );
}
