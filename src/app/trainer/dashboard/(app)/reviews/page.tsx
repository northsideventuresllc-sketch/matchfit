import type { Metadata } from "next";
import { TrainerReviewsDashboardClient } from "@/components/trainer/trainer-reviews-dashboard-client";

export const metadata: Metadata = {
  title: "CLIENT REVIEWS | Trainer | Match Fit",
};

export default function TrainerReviewsPage() {
  return (
    <div className="rounded-3xl border border-white/[0.08] bg-[#12151C]/90 p-6 text-left shadow-[0_30px_80px_-40px_rgba(0,0,0,0.85)] backdrop-blur-xl sm:p-8">
      <TrainerReviewsDashboardClient />
    </div>
  );
}
