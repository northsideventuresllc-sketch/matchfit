import Link from "next/link";

type Props = {
  /** Short label for the area they tried to open, e.g. "Featured Trainer". */
  areaLabel: string;
};

/**
 * Shown when a signed-in trainer opens a Premium Hub route without Premium Page enrollment.
 */
export function PremiumStudioLockedNotice(props: Props) {
  return (
    <div className="mx-auto max-w-lg space-y-6 rounded-3xl border border-white/[0.1] bg-[#12151C]/90 p-8 text-center shadow-[0_28px_80px_-36px_rgba(255,126,0,0.25)]">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-[#FF7E00]/90">Premium Page</p>
      <h1 className="text-2xl font-black uppercase tracking-[0.06em] text-white/95">{props.areaLabel}</h1>
      <p className="text-sm leading-relaxed text-white/60">
        This workspace is reserved for coaches on the Premium Page. Enroll on your Premium Page to unlock FitHub
        publishing, featured placement tools, and promotion tokens—everything stays in one hub once you are in.
      </p>
      <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-center">
        <Link
          href="/trainer/dashboard/premium"
          className="inline-flex min-h-[3rem] flex-1 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#FFD34E_0%,#FF7E00_55%,#E32B2B_100%)] px-6 text-xs font-black uppercase tracking-[0.1em] text-[#0B0C0F] sm:flex-initial"
        >
          View Premium Page
        </Link>
        <Link
          href="/trainer/dashboard"
          className="inline-flex min-h-[3rem] flex-1 items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] px-6 text-xs font-black uppercase tracking-[0.1em] text-white/90 transition hover:border-white/25 sm:flex-initial"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
