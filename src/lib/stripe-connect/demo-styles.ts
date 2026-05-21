/** Shared class names for the Connect demo (Match Fit dark + orange accent). */
export const connectDemoStyles = {
  page: "min-h-dvh bg-[#0B0C0F] text-white antialiased",
  card: "rounded-2xl border border-white/[0.08] bg-[#12151c]/90 p-6 shadow-lg",
  label: "text-xs font-semibold uppercase tracking-wide text-white/50",
  input:
    "mt-1 w-full rounded-xl border border-white/10 bg-[#0E1016] px-4 py-3 text-[15px] text-white outline-none ring-[#FF7E00]/40 focus:border-[#FF7E00]/40 focus:ring-2",
  btnPrimary:
    "inline-flex min-h-[2.75rem] items-center justify-center rounded-xl bg-[linear-gradient(135deg,#FFD34E_0%,#FF7E00_45%,#E32B2B_100%)] px-5 text-sm font-black uppercase tracking-[0.08em] text-[#0B0C0F] transition hover:opacity-95 disabled:opacity-50",
  btnSecondary:
    "inline-flex min-h-[2.5rem] items-center justify-center rounded-xl border border-white/15 bg-white/5 px-4 text-sm font-semibold text-white/90 hover:border-white/25",
  muted: "text-sm text-white/55",
  err: "text-sm text-rose-300/90",
  ok: "text-sm text-emerald-200/90",
  badgeOk: "rounded-lg border border-emerald-400/35 bg-emerald-500/15 px-2 py-1 text-[10px] font-bold uppercase text-emerald-100",
  badgeWarn: "rounded-lg border border-amber-400/35 bg-amber-500/15 px-2 py-1 text-[10px] font-bold uppercase text-amber-100",
} as const;
