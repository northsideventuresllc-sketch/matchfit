"use client";

import { useId, type ReactElement } from "react";
import type { MatchFitOfficialSocialPlatform } from "@/lib/match-fit-official-social";

type IconProps = { className?: string };

/** App-tile style marks for Match Fit official social links (24×24 viewBox). */
function OfficialThreadsIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <rect x="2" y="2" width="20" height="20" rx="5.5" fill="#000000" />
      <path
        fill="white"
        d="M12.35 5.5c2.55 0 4.65 2.05 4.65 4.6 0 .95-.3 1.85-.8 2.6 1.1.55 1.85 1.65 1.85 2.95 0 1.85-1.5 3.35-3.35 3.35-.9 0-1.7-.35-2.35-.9-.65.55-1.45.9-2.35.9-1.85 0-3.35-1.5-3.35-3.35 0-1.3.75-2.4 1.85-2.95-.5-.75-.8-1.65-.8-2.6 0-2.55 2.1-4.6 4.65-4.6Zm0 9.2c2.15 0 4.15-.45 5.55-1.3.25.95.4 1.95.4 3H6.4c0-1.05.15-2.05.4-3 1.4.85 3.4 1.3 5.55 1.3Z"
      />
    </svg>
  );
}

function OfficialTikTokIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <rect x="2" y="2" width="20" height="20" rx="5.5" fill="#000000" />
      <path
        fill="#25F4EE"
        d="M15.8 7.2v2.1c-.9-.05-1.8.15-2.5.55v5.4a3.4 3.4 0 1 1-3.4-3.4h.25v2.05a1.35 1.35 0 1 0 1.35 1.35V6.2h2.35c.15 1.05.6 1.95 1.45 2.55.35.25.75.42 1.15.5Z"
      />
      <path
        fill="#FE2C55"
        d="M15.8 7.2c-.4-.08-.8-.25-1.15-.5-.85-.6-1.3-1.5-1.45-2.55h2.35v2.05Z"
        transform="translate(0.35 0.35)"
      />
      <path
        fill="white"
        d="M15.5 7v2c-.85-.05-1.65.12-2.35.48v5.25a3.15 3.15 0 1 1-3.15-3.15h.2v1.9a1.25 1.25 0 1 0 1.25 1.25V6h2.2c.12.95.52 1.78 1.3 2.35.32.22.68.38 1.05.45Z"
      />
    </svg>
  );
}

function OfficialFacebookIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <rect x="2" y="2" width="20" height="20" rx="5.5" fill="#1877F2" />
      <path
        fill="white"
        d="M13.2 20.5v-6.2h2.1l.4-2.7h-2.5V9.6c0-.75.2-1.25 1.25-1.25h1.35V6.1c-.25-.02-1.1-.1-2.1-.1-2.05 0-3.5 1.25-3.5 3.55v2h-2.1v2.7h2.1v6.2h2.6Z"
      />
    </svg>
  );
}

function OfficialInstagramIcon({ className }: IconProps) {
  const gradientId = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <defs>
        <linearGradient id={gradientId} x1="2" y1="22" x2="22" y2="2" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FEDA75" />
          <stop offset="25%" stopColor="#FA7E1E" />
          <stop offset="50%" stopColor="#D62976" />
          <stop offset="75%" stopColor="#962FBF" />
          <stop offset="100%" stopColor="#4F5BD5" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="20" height="20" rx="5.5" fill={`url(#${gradientId})`} />
      <rect
        x="7.25"
        y="7.25"
        width="9.5"
        height="9.5"
        rx="2.75"
        fill="none"
        stroke="white"
        strokeWidth="1.5"
      />
      <circle cx="12" cy="12" r="2.35" fill="none" stroke="white" strokeWidth="1.5" />
      <circle cx="16.35" cy="7.65" r="1.1" fill="white" />
    </svg>
  );
}

const OFFICIAL_ICON: Record<MatchFitOfficialSocialPlatform, (props: IconProps) => ReactElement> = {
  threads: OfficialThreadsIcon,
  tiktok: OfficialTikTokIcon,
  facebook: OfficialFacebookIcon,
  instagram: OfficialInstagramIcon,
};

export function MatchFitOfficialSocialIcon({
  platform,
  className,
}: {
  platform: MatchFitOfficialSocialPlatform;
  className?: string;
}) {
  const Icon = OFFICIAL_ICON[platform];
  return <Icon className={className} />;
}
