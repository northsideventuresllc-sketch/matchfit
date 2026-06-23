import type { Metadata } from "next";
import { Suspense } from "react";
import TrainerSignupTierClient from "./trainer-signup-tier-client";

export const metadata: Metadata = {
  title: "Choose Account Type | Fitness Pro Signup | Match Fit",
};

export default function TrainerSignupTierPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-[#0B0C0F] px-5 py-16 text-white">Loading…</div>}>
      <TrainerSignupTierClient />
    </Suspense>
  );
}
