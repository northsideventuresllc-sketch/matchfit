"use client";

import {
  listBetaAtlantaMetroZipCodes,
  summarizeBetaAtlantaMetroZipCoverage,
} from "@/lib/beta-atlanta-metro-zips";

type Props = {
  /** Short banner vs. settings-style block with delivery-mode context. */
  variant?: "signup" | "match-settings" | "inline";
  className?: string;
};

const zipCodes = listBetaAtlantaMetroZipCodes();
const zipSummary = summarizeBetaAtlantaMetroZipCoverage();

export function BetaInPersonRolloutDisclaimer({ variant = "inline", className = "" }: Props) {
  const base =
    variant === "signup"
      ? "rounded-xl border border-[#FF7E00]/25 bg-[#FF7E00]/[0.06] px-4 py-3 text-sm leading-relaxed text-white/70"
      : variant === "match-settings"
        ? "rounded-xl border border-amber-400/25 bg-amber-500/[0.07] px-4 py-3 text-sm leading-relaxed text-amber-50/90"
        : "rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-3 text-xs leading-relaxed text-white/45 sm:text-[13px]";

  const intro =
    variant === "match-settings" ? (
      <>
        <span className="font-semibold text-amber-200">Beta rollout:</span> You can select in-person or mobile
        coaching as a preference, but{" "}
        <span className="font-semibold text-white/85">in-person services are launching first in the Atlanta metro
        area only</span>. Virtual, DIY, and nutrition services are available nationwide. We will expand in-person
        coverage beyond beta as soon as possible.
      </>
    ) : (
      <>
        <span className="font-semibold text-[#FFD34E]">Beta:</span> Client sign-up is open nationwide across the
        United States (up to 150 beta client slots).{" "}
        <span className="font-semibold text-white/85">In-person coaching</span> is available only in the Atlanta
        metro area during this rollout; virtual, DIY, and nutrition services work anywhere in the U.S. We will expand
        in-person coverage beyond beta as soon as possible.
      </>
    );

  return (
    <div className={`${base} ${className}`.trim()}>
      <p>{intro}</p>
      <details className="mt-2 group">
        <summary className="cursor-pointer list-none text-[#FF7E00]/90 underline-offset-2 hover:underline [&::-webkit-details-marker]:hidden">
          <span className="font-semibold">Atlanta in-person ZIP codes</span>
          <span className="ml-1 text-white/40 group-open:hidden">(show list)</span>
        </summary>
        <p className="mt-2 text-white/50">
          Coverage summary: <span className="text-white/65">{zipSummary}</span>
        </p>
        <p className="mt-2 max-h-40 overflow-y-auto whitespace-normal break-words font-mono text-[11px] leading-relaxed text-white/55 sm:text-xs">
          {zipCodes.join(", ")}
        </p>
      </details>
    </div>
  );
}
