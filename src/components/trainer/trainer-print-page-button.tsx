"use client";

export function TrainerPrintPageButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-xl border border-white/15 bg-white/[0.08] px-4 py-2.5 text-xs font-black uppercase tracking-[0.08em] text-white transition print:hidden hover:border-white/25"
    >
      Print / Save as PDF
    </button>
  );
}
