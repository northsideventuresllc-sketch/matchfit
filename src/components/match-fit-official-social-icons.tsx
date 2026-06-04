"use client";

import { useId, type ReactElement } from "react";
import type { MatchFitOfficialSocialPlatform } from "@/lib/match-fit-official-social";

type IconProps = { className?: string };

/** Official Threads @ mark (192×192 artboard) scaled inside the app tile. */
const THREADS_AT_PATH =
  "M141.537 88.9883C140.71 88.5919 139.87 88.2104 139.019 87.8451C137.537 60.5382 122.616 44.905 97.5619 44.745C97.4484 44.7443 97.3355 44.7443 97.222 44.7443C82.2364 44.7443 69.7731 51.1409 62.102 62.7807L75.881 72.2328C81.6116 63.5383 90.6052 61.6848 97.2286 61.6848C97.3051 61.6848 97.3819 61.6848 97.4576 61.6855C105.707 61.7381 111.932 64.1366 115.961 68.814C118.893 72.2193 120.854 76.925 121.825 82.8638C114.511 81.6207 106.601 81.2385 98.145 81.7233C74.3247 83.0954 59.0111 96.9879 60.0396 116.292C60.5615 126.084 65.4397 134.508 73.775 140.011C80.8224 144.663 89.899 146.938 99.3323 146.423C111.79 145.74 121.563 140.987 128.381 132.296C133.559 125.696 136.834 117.143 138.28 106.366C144.217 109.949 148.617 114.664 151.047 120.332C155.179 129.967 155.42 145.8 142.501 158.708C131.182 170.016 117.576 174.908 97.0135 175.059C74.2042 174.89 56.9538 167.575 45.7381 153.317C35.2355 139.966 29.8077 120.682 29.6052 96C29.8077 71.3178 35.2355 52.0336 45.7381 38.6827C56.9538 24.4249 74.2039 17.11 97.0132 16.9405C119.988 17.1113 137.539 24.4614 149.184 38.788C154.894 45.8136 159.199 54.6488 162.037 64.9503L178.184 60.6422C174.744 47.9622 169.331 37.0357 161.965 27.974C147.036 9.60668 125.202 0.195148 97.0695 0H96.9569C68.8816 0.19447 47.2921 9.6418 32.7883 28.0793C19.8819 44.4864 13.2244 67.3157 13.0007 95.9325L13 96L13.0007 96.0675C13.2244 124.684 19.8819 147.514 32.7883 163.921C47.2921 182.358 68.8816 191.806 96.9569 192H97.0695C122.03 191.827 139.624 185.292 154.118 170.811C173.081 151.866 172.51 128.119 166.26 113.541C161.776 103.087 153.227 94.5962 141.537 88.9883ZM98.4405 129.507C88.0005 130.095 77.1544 125.409 76.6196 115.372C76.2232 107.93 81.9158 99.626 99.0812 98.6368C101.047 98.5234 102.976 98.468 104.871 98.468C111.106 98.468 116.939 99.0737 122.242 100.233C120.264 124.935 108.662 128.946 98.4405 129.507Z";

/** App-tile style marks for Match Fit official social links (24×24 viewBox). */
function OfficialThreadsIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <rect x="2" y="2" width="20" height="20" rx="5.5" fill="#000000" />
      <svg x="3.25" y="3.25" width="17.5" height="17.5" viewBox="0 0 192 192" aria-hidden>
        <path fill="white" d={THREADS_AT_PATH} />
      </svg>
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
        d="M16.15 7.55c-.4-.08-.8-.25-1.15-.5-.85-.6-1.3-1.5-1.45-2.55h2.35v2.05c-.9-.05-1.8.15-2.5.55v5.4a3.4 3.4 0 1 1-3.4-3.4h.25v2.05a1.35 1.35 0 1 0 1.35 1.35V6.55h2.35c.15 1.05.6 1.95 1.45 2.55.35.25.75.42 1.15.5Z"
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
