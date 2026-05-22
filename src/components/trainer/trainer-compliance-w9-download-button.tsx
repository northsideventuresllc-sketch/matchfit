"use client";

export function TrainerComplianceW9DownloadButton() {
  return (
    <button
      type="button"
      onClick={() => window.open("/api/trainer/compliance/w9-download", "_blank")}
      className="rounded-xl border border-[#FF7E00]/35 bg-[#FF7E00]/10 px-4 py-2.5 text-xs font-black uppercase tracking-[0.08em] text-white transition hover:border-[#FF7E00]/50"
    >
      Download W-9 Summary
    </button>
  );
}
