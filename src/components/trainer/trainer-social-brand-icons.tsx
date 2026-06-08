import type { ReactNode } from "react";
import type { TrainerSocialPlatform } from "@/lib/trainer-social-urls";

type IconProps = { className?: string };

function InstagramIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={props.className} aria-hidden>
      <rect x="2" y="2" width="20" height="20" rx="6" fill="#E4405F" />
      <circle cx="12" cy="12" r="4.25" fill="none" stroke="white" strokeWidth="1.5" />
      <circle cx="17" cy="7" r="1.25" fill="white" />
    </svg>
  );
}

const TIKTOK_NOTE_PATH =
  "M19.589 6.686a4.793 4.793 0 0 1-3.77-4.245V2h-3.445v13.672a2.896 2.896 0 0 1-5.201 1.743 2.895 2.895 0 0 1 3.183-4.251v-3.5a6.329 6.329 0 0 0-1.183-.11 6.33 6.33 0 0 0-6.33 6.33 6.33 6.33 0 0 0 9.347 5.577v-7.564a8.188 8.188 0 0 0 4.773 1.527V6.686h-.007z";

function TikTokIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={props.className} aria-hidden>
      <path fill="#25F4EE" d={TIKTOK_NOTE_PATH} transform="translate(-0.55,-0.45)" />
      <path fill="#FE2C55" d={TIKTOK_NOTE_PATH} transform="translate(0.55,0.45)" />
      <path fill="#FFFFFF" d={TIKTOK_NOTE_PATH} />
    </svg>
  );
}

function FacebookIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={props.className} aria-hidden>
      <path
        fill="#1877F2"
        d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.99 3.66 9.12 8.44 9.88v-6.99H7.9V12h2.54V9.79c0-2.51 1.49-3.89 3.77-3.89 1.09 0 2.23.19 2.23.19v2.47h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.45 2.89h-2.33v6.99C18.34 21.12 22 16.99 22 12Z"
      />
    </svg>
  );
}

function LinkedInIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={props.className} aria-hidden>
      <path
        fill="#0A66C2"
        d="M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.95v5.66H9.35V9h3.41v1.56h.05c.48-.9 1.65-1.85 3.4-1.85 3.64 0 4.31 2.4 4.31 5.52v6.22ZM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12ZM7.12 20.45H3.55V9h3.57v11.45Z"
      />
    </svg>
  );
}

const PLATFORM_ICON: Record<Exclude<TrainerSocialPlatform, "other">, (p: IconProps) => ReactNode> = {
  instagram: (p) => <InstagramIcon {...p} />,
  tiktok: (p) => <TikTokIcon {...p} />,
  facebook: (p) => <FacebookIcon {...p} />,
  linkedin: (p) => <LinkedInIcon {...p} />,
};

export function TrainerSocialBrandIcon(props: {
  platform: Exclude<TrainerSocialPlatform, "other">;
  className?: string;
}) {
  const I = PLATFORM_ICON[props.platform];
  return I({ className: props.className });
}

/** Compact row of the four platform marks (visual legend). */
export function TrainerSocialBrandStrip() {
  const wrap =
    "flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.1] bg-[#0E1016]/90 shadow-inner";
  return (
    <div
      className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-white/[0.08] bg-[#12151C]/60 px-4 py-3"
      aria-hidden
    >
      <span className={wrap} title="Instagram">
        <TrainerSocialBrandIcon platform="instagram" className="h-6 w-6" />
      </span>
      <span className={wrap} title="TikTok">
        <TrainerSocialBrandIcon platform="tiktok" className="h-6 w-6" />
      </span>
      <span className={wrap} title="Facebook">
        <TrainerSocialBrandIcon platform="facebook" className="h-6 w-6" />
      </span>
      <span className={wrap} title="LinkedIn">
        <TrainerSocialBrandIcon platform="linkedin" className="h-6 w-6" />
      </span>
    </div>
  );
}
