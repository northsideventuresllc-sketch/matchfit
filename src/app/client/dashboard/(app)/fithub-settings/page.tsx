import type { Metadata } from "next";
import Link from "next/link";
import { ClientFitHubSettingsForm } from "./client-fithub-settings-form";

export const metadata: Metadata = {
  title: "FitHub settings | Client | Match Fit",
};

export default function ClientFitHubSettingsPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FF7E00]/90">Personalization</p>
        <h1 className="text-3xl font-black tracking-[0.04em] sm:text-4xl">FitHub settings</h1>
        <p className="mx-auto max-w-xl text-sm leading-relaxed text-white/50">
          Tune how your feed is built, which formats you see, and how aggressively we highlight coaches you already follow.
        </p>
        <p className="text-xs text-white/40">
          <Link href="/client/dashboard/fithub" className="text-[#FF7E00] underline-offset-2 hover:underline">
            Back to FitHub
          </Link>
        </p>
      </header>
      <section className="rounded-3xl border border-white/[0.08] bg-[#12151C]/90 p-6 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.85)] backdrop-blur-xl sm:p-8">
        <ClientFitHubSettingsForm />
      </section>
    </div>
  );
}
