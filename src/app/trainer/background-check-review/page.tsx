import Link from "next/link";

const COPY: Record<string, { title: string; body: string }> = {
  approved: {
    title: "Background check approved",
    body: "The trainer may continue Match Fit onboarding. They have been notified by email.",
  },
  denied: {
    title: "Background check denied",
    body: "The trainer account has been closed for onboarding and will not count toward platform totals. They have been notified.",
  },
  already_approved: { title: "Already approved", body: "This screening was already marked approved." },
  already_denied: { title: "Already denied", body: "This screening was already denied." },
  not_reviewable: {
    title: "Not eligible for review",
    body: "This account is not awaiting human review. Open the Checkr dashboard for the latest vendor status.",
  },
  invalid: { title: "Invalid link", body: "This review link is invalid or has expired." },
  missing: { title: "Account not found", body: "The trainer record could not be found." },
  error: { title: "Something went wrong", body: "Please try again from the review email or contact engineering." },
};

export default async function TrainerBackgroundCheckReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ decision?: string }>;
}) {
  const { decision = "invalid" } = await searchParams;
  const copy = COPY[decision] ?? COPY.invalid;

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-6 px-6 py-16 text-white">
      <h1 className="text-2xl font-black tracking-tight">{copy.title}</h1>
      <p className="text-sm leading-relaxed text-white/65">{copy.body}</p>
      <Link
        href="/"
        className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] px-4 text-sm font-semibold text-white hover:border-white/25"
      >
        Return to Match Fit
      </Link>
    </main>
  );
}
