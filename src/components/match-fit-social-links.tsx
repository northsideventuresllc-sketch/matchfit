import Link from "next/link";
import { MatchFitOfficialSocialIcon } from "@/components/match-fit-official-social-icons";
import { MATCH_FIT_OFFICIAL_SOCIAL_LINKS } from "@/lib/match-fit-official-social";

type Props = {
  /** Visual density for footers vs auth pages. */
  variant?: "footer" | "compact";
  className?: string;
  showLabel?: boolean;
};

export function MatchFitSocialLinks({
  variant = "footer",
  className = "",
  showLabel = true,
}: Props) {
  const iconSize = variant === "compact" ? "h-5 w-5" : "h-6 w-6";
  const buttonClass =
    variant === "compact"
      ? "flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.1] bg-[#0E1016]/80 transition hover:border-[#FF7E00]/35 hover:bg-white/[0.06]"
      : "flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.1] bg-[#0E1016]/90 shadow-inner transition hover:border-[#FF7E00]/35 hover:bg-white/[0.06]";

  return (
    <div className={className}>
      {showLabel ? (
        <p
          className={
            variant === "compact"
              ? "text-center text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-white/40"
              : "text-center text-xs font-semibold uppercase tracking-[0.18em] text-white/45"
          }
        >
          Follow Match Fit
        </p>
      ) : null}
      <ul
        className={`${showLabel ? "mt-3 " : ""}flex flex-nowrap items-center justify-end gap-2 sm:gap-3 ${variant === "footer" ? "sm:gap-4 sm:justify-center" : ""}`}
        aria-label="Match Fit on social media"
      >
        {MATCH_FIT_OFFICIAL_SOCIAL_LINKS.map((item) => (
          <li key={item.platform}>
            <Link
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClass}
              title={`Match Fit on ${item.label}`}
            >
              <MatchFitOfficialSocialIcon platform={item.platform} className={iconSize} />
              <span className="sr-only">{item.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
