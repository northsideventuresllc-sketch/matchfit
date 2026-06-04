/** Shared Match Fit brand styling for the administrator portal (aligned with home + member dashboards). */

export const adminPortalMainClass =
  "relative min-h-dvh overflow-x-hidden bg-[#0B0C0F] text-white antialiased";

export const adminPortalBackgroundLayers = {
  warmGlow:
    "pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(255,211,78,0.14),transparent_55%),radial-gradient(ellipse_90%_60%_at_100%_0%,rgba(255,126,0,0.1),transparent_50%),radial-gradient(ellipse_70%_50%_at_0%_100%,rgba(227,43,43,0.08),transparent_55%)]",
  topAccent:
    "pointer-events-none absolute inset-x-0 top-0 h-[22rem] bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(255,126,0,0.14),transparent_55%)]",
  vignette:
    "pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(45,52,64,0.25)_0%,transparent_35%,transparent_70%,rgba(11,12,15,0.92)_100%)]",
} as const;

export const adminPortalEyebrowClass =
  "text-[11px] font-bold uppercase tracking-[0.18em] text-[#FF7E00]/80";

export const adminPortalLinkClass =
  "text-[#FF7E00] underline-offset-4 transition hover:text-[#FFD34E] hover:underline";

export const adminPortalNavLinkClass =
  "rounded-xl px-3 py-2.5 text-xs font-black uppercase tracking-[0.1em] transition";

export const adminPortalNavLinkActiveClass =
  "bg-[linear-gradient(135deg,rgba(255,211,78,0.2),rgba(255,126,0,0.18),rgba(227,43,43,0.12))] text-white shadow-[0_8px_24px_-12px_rgba(255,126,0,0.35)]";

export const adminPortalNavLinkIdleClass =
  "border border-white/[0.07] bg-[#0E1016]/60 text-white/45 hover:bg-white/[0.05] hover:text-white/80";

export const adminPortalPrimaryButtonClass =
  "rounded-xl border border-[#FF7E00]/35 bg-[#FF7E00]/15 px-4 py-2.5 text-xs font-black uppercase tracking-[0.1em] text-[#FFD34E] transition hover:border-[#FF7E00]/55 hover:bg-[#FF7E00]/25 disabled:opacity-40";

export const adminPortalSecondaryButtonClass =
  "rounded-xl border border-white/15 bg-white/[0.04] px-4 py-2.5 text-xs font-black uppercase tracking-[0.1em] text-white/80 transition hover:bg-white/[0.07] disabled:opacity-40";

export const adminPortalCardClass =
  "rounded-2xl border border-white/[0.08] bg-[#12151C]/75 shadow-[0_34px_90px_-50px_rgba(227,43,43,0.25)] backdrop-blur-xl";

export const adminPortalSectionEyebrowClass =
  "text-[10px] font-black uppercase tracking-[0.22em] text-[#FF7E00]/70";
