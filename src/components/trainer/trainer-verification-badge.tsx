import type { TrainerVerificationBadge } from "@/lib/trainer-client-discovery";

const LABELS: Record<TrainerVerificationBadge, string> = {
  verified: "Verified",
  verification_in_progress: "Verification in progress",
};

const STYLES: Record<TrainerVerificationBadge, string> = {
  verified:
    "border-emerald-500/35 bg-emerald-500/10 text-emerald-100",
  verification_in_progress:
    "border-amber-500/35 bg-amber-500/10 text-amber-100",
};

export function TrainerVerificationBadgePill({
  badge,
  className = "",
}: {
  badge: TrainerVerificationBadge;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-lg border px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.1em] ${STYLES[badge]} ${className}`}
    >
      {LABELS[badge]}
    </span>
  );
}
