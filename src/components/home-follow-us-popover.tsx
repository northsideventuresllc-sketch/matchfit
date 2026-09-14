"use client";

import { useEffect, useState } from "react";
import { MatchFitSocialLinks } from "@/components/match-fit-social-links";

const buttonClass =
  "inline-flex min-h-11 items-center justify-center rounded-2xl border border-white/15 bg-white/[0.04] px-5 text-sm font-semibold uppercase tracking-[0.04em] text-white/80 transition hover:border-white/25 hover:bg-white/[0.07] hover:text-white";

/** "Follow us for updates" button that opens a popup with Match Fit's official social links. */
export function HomeFollowUsPopover() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={buttonClass}>
        Follow Us For Updates
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close follow Match Fit popup"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="follow-match-fit-popover-heading"
            className="relative w-full max-w-sm rounded-3xl border border-white/10 bg-[#12151C] p-6 shadow-[0_40px_100px_-30px_rgba(0,0,0,0.9)]"
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-white/60 transition hover:border-white/25 hover:text-white"
            >
              ✕
            </button>
            <h2
              id="follow-match-fit-popover-heading"
              className="pr-8 text-lg font-black uppercase tracking-wide text-white"
            >
              Follow Match Fit
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-white/55">
              Real progress, coach spotlights, and launch news — on our official channels.
            </p>
            <MatchFitSocialLinks variant="footer" showLabel={false} className="mt-5" />
          </div>
        </div>
      ) : null}
    </>
  );
}
