type MatchFitBrandPageBackgroundProps = {
  /** Admin login uses a cooler cyan/blue wash instead of brand orange. */
  variant?: "brand" | "admin";
};

/** Fixed decorative layers — avoids repaint glitches when scrolling on iOS Safari. */
export function MatchFitBrandPageBackground({ variant = "brand" }: MatchFitBrandPageBackgroundProps) {
  const base = variant === "admin" ? "bg-[#050608]" : "bg-[#0B0C0F]";

  return (
    <>
      <div aria-hidden className={`pointer-events-none fixed inset-0 -z-10 ${base}`} />
      {variant === "admin" ? (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_100%_70%_at_50%_-15%,rgba(34,211,238,0.12),transparent_55%),radial-gradient(ellipse_80%_50%_at_100%_0%,rgba(59,130,246,0.08),transparent_50%)]"
        />
      ) : (
        <>
          <div
            aria-hidden
            className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(255,211,78,0.14),transparent_55%),radial-gradient(ellipse_90%_60%_at_100%_0%,rgba(255,126,0,0.1),transparent_50%),radial-gradient(ellipse_70%_50%_at_0%_100%,rgba(227,43,43,0.08),transparent_55%)]"
          />
          <div
            aria-hidden
            className="pointer-events-none fixed inset-0 -z-10 bg-[linear-gradient(180deg,rgba(45,52,64,0.35)_0%,transparent_40%,transparent_75%,rgba(11,12,15,0.92)_100%)]"
          />
        </>
      )}
    </>
  );
}

export const matchFitBrandPageMainClass =
  "relative min-h-svh overflow-x-hidden overscroll-y-none bg-[#0B0C0F] text-white antialiased";

export const matchFitAdminPageMainClass =
  "relative min-h-svh overflow-x-hidden overscroll-y-none bg-[#050608] text-white antialiased";

/** Solid on mobile; subtle blur only on larger screens to avoid iOS scroll flicker. */
export const matchFitAuthCardClass =
  "rounded-3xl border border-white/[0.08] bg-[#12151C] p-6 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.85)] max-md:[backdrop-filter:none] md:bg-[#12151C]/90 md:backdrop-blur-xl sm:p-8";

export const matchFitAdminAuthCardClass =
  "rounded-3xl border border-white/[0.08] bg-[#0c0f14] p-6 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)] max-md:[backdrop-filter:none] md:bg-[#0c0f14]/95 md:backdrop-blur-xl sm:p-8";
