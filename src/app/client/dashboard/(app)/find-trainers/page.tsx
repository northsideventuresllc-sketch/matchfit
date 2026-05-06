import type { Metadata } from "next";
import Link from "next/link";
import { FindTrainersClient } from "./find-trainers-client";

export const metadata: Metadata = {
  title: "Find coaches | Client | Match Fit",
};

export default function ClientFindTrainersPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FF7E00]/90">Discover</p>
        <h1 className="text-3xl font-black uppercase tracking-[0.06em] sm:text-4xl">Find coaches</h1>
        <p className="mx-auto max-w-xl text-sm leading-relaxed text-white/50">
          Rankings use your{" "}
          <Link href="/client/dashboard/preferences" className="text-[#FF7E00] underline-offset-2 hover:underline">
            Match Preferences
          </Link>
          . Toggle relaxed search to include near matches.
        </p>
      </header>
      <FindTrainersClient />
    </div>
  );
}
