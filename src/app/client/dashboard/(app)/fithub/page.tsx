import type { Metadata } from "next";
import Link from "next/link";
import { ClientFitHubFeedClient } from "@/components/client/client-fithub-feed-client";

export const metadata: Metadata = {
  title: "FitHub | Client | Match Fit",
};

export default function ClientFitHubPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FF7E00]/90">MATCHFIT&apos;S IN-HOUSE SOCIAL MEDIA PAGE</p>
        <h1 className="text-3xl font-black uppercase tracking-[0.06em] sm:text-4xl">FitHub</h1>
        <p className="mx-auto max-w-xl text-sm leading-relaxed text-white/50">
          Scroll through posts from coaches. Like, comment, repost, and share. Tap a name to open their profile.
        </p>
        <p className="text-xs text-white/40">
          <Link href="/client/dashboard/fithub-settings" className="text-[#FF7E00] underline-offset-2 hover:underline">
            FitHub Settings
          </Link>
        </p>
      </header>
      <ClientFitHubFeedClient />
    </div>
  );
}
