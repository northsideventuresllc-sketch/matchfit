import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";

export const metadata: Metadata = {
  title: "Premium studio | Trainer | Match Fit",
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
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FF7E00]/90">Premium studio</p>
          <h1 className="mt-1 text-2xl font-black uppercase tracking-[0.06em] sm:text-3xl">Your feed</h1>
          <p className="mt-2 max-w-xl text-sm text-white/50">
            Instagram- or TikTok-style composer, grid, and reels will plug in here. Upload photos, videos, and text
            posts for clients who follow your Premium Page.
          </p>
        </div>
        <Link
          href="/trainer/dashboard/premium"
          className="text-xs font-semibold uppercase tracking-wide text-[#FF7E00] underline-offset-2 hover:underline"
        >
          Premium settings
        </Link>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        {["Photo post", "Video clip", "Story / update"].map((label) => (
          <div
            key={label}
            className="flex aspect-[4/5] flex-col items-center justify-center rounded-3xl border border-dashed border-white/[0.12] bg-[#0E1016]/50 p-4 text-center"
          >
            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-white/35">Placeholder</span>
            <p className="mt-2 text-sm font-semibold text-white/60">{label}</p>
            <p className="mt-2 text-xs text-white/35">Composer &amp; preview will replace this tile.</p>
          </div>
        ))}
      </div>
    </div>
  );
}
