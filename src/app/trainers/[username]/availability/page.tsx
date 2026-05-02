import Link from "next/link";
import { notFound } from "next/navigation";
import { summarizeTrainerAvailabilityForPublic } from "@/lib/booking-availability";
import { isTrainerComplianceComplete } from "@/lib/trainer-compliance-complete";
import { prisma } from "@/lib/prisma";

type Props = { params: Promise<{ username: string }> };

export default async function TrainerAvailabilityPage({ params }: Props) {
  const { username } = await params;
  const handle = decodeURIComponent(username).trim();
  const trainer = await prisma.trainer.findUnique({
    where: { username: handle },
    select: {
      username: true,
      preferredName: true,
      firstName: true,
      lastName: true,
      deidentifiedAt: true,
      profile: {
        select: {
          dashboardActivatedAt: true,
          hasSignedTOS: true,
          hasUploadedW9: true,
          backgroundCheckStatus: true,
          backgroundCheckClearedAt: true,
          onboardingTrackCpt: true,
          onboardingTrackNutrition: true,
          onboardingTrackSpecialist: true,
          certificationReviewStatus: true,
          nutritionistCertificationReviewStatus: true,
          specialistCertificationReviewStatus: true,
          bookingAvailabilityJson: true,
          bookingTimezone: true,
        },
      },
    },
  });
  const profile = trainer?.profile ?? null;
  const published =
    trainer &&
    !trainer.deidentifiedAt &&
    profile &&
    profile.dashboardActivatedAt != null &&
    isTrainerComplianceComplete(profile);
  if (!published || !trainer) {
    notFound();
  }
  const tz = profile.bookingTimezone?.trim() || "America/New_York";
  const summary = summarizeTrainerAvailabilityForPublic(profile.bookingAvailabilityJson, tz);
  const label =
    trainer.preferredName?.trim() ||
    [trainer.firstName, trainer.lastName].filter(Boolean).join(" ").trim() ||
    "Coach";

  return (
    <main className="min-h-dvh bg-[#07080C] px-5 py-10 text-white sm:px-8 sm:py-12">
      <div className="mx-auto max-w-lg space-y-6">
        <Link href={`/trainers/${encodeURIComponent(trainer.username)}`} className="text-xs font-semibold text-[#FF9A4A] underline-offset-2 hover:underline">
          ← Back to profile
        </Link>
        <div>
          <h1 className="text-2xl font-black tracking-tight">Availability</h1>
          <p className="mt-2 text-sm text-white/55">
            {label} (@{trainer.username}) · times shown in <span className="font-semibold text-white/80">{tz}</span>
          </p>
        </div>
        <div className="space-y-3 rounded-2xl border border-white/[0.08] bg-[#10131c]/90 p-5 text-sm leading-relaxed text-white/80">
          {summary.lines.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
        <p className="text-xs text-white/45">
          Purchases and bookings are coordinated in Match Fit chat after you have paid for a service with this coach.
        </p>
      </div>
    </main>
  );
}
