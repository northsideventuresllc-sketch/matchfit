import Link from "next/link";
import {
  MATCH_FIT_OFFICIAL_SOCIAL_LINKS,
  type MatchFitOfficialSocialPlatform,
} from "@/lib/match-fit-official-social";
import { TrainerSocialBrandIcon } from "@/components/trainer/trainer-social-brand-icons";

function ThreadsIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <rect x="2" y="2" width="20" height="20" rx="6" fill="#101010" />
      <path
        fill="white"
        d="M12 6.2c1.35 0 2.45 1.04 2.45 2.32 0 .5-.16.96-.43 1.34.58.35.97.98.97 1.71 0 1.1-.9 1.99-2.01 1.99-.55 0-1.05-.22-1.42-.58-.37.36-.87.58-1.42.58-1.11 0-2.01-.89-2.01-1.99 0-.73.39-1.36.97-1.71a2.28 2.28 0 0 1-.43-1.34c0-1.28 1.1-2.32 2.45-2.32Zm0 8.9c2.35 0 4.55-.52 6.05-1.42.28 1.05.45 2.18.45 3.32H5.5c0-1.14.17-2.27.45-3.32 1.5.9 3.7 1.42 6.05 1.42Z"
      />
    </svg>
  );
}

function SocialIcon({ platform, className }: { platform: MatchFitOfficialSocialPlatform; className?: string }) {
  if (platform === "threads") {
    return <ThreadsIcon className={className} />;
  }
  return (
    <TrainerSocialBrandIcon
      platform={platform}
      className={className}
    />
  );
}

type Props = {
  /** Visual density for footers vs auth pages. */
  variant?: "footer" | "compact";
  className?: string;
};

export function MatchFitSocialLinks({ variant = "footer", className = "" }: Props) {
  const iconSize = variant === "compact" ? "h-5 w-5" : "h-6 w-6";
  const buttonClass =
    variant === "compact"
      ? "flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.1] bg-[#0E1016]/80 transition hover:border-[#FF7E00]/35 hover:bg-white/[0.06]"
      : "flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.1] bg-[#0E1016]/90 shadow-inner transition hover:border-[#FF7E00]/35 hover:bg-white/[0.06]";

  return (
    <div className={className}>
      <p
        className={
          variant === "compact"
            ? "text-center text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-white/40"
            : "text-center text-xs font-semibold uppercase tracking-[0.18em] text-white/45"
        }
      >
        Follow Match Fit
      </p>
      <ul
        className={`mt-3 flex flex-wrap items-center justify-center gap-3 ${variant === "footer" ? "sm:gap-4" : ""}`}
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
              <SocialIcon platform={item.platform} className={iconSize} />
              <span className="sr-only">{item.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
