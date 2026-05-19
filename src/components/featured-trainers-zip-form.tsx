"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function FeaturedTrainersZipForm({ initialZip }: { initialZip?: string | null }) {
  const router = useRouter();
  const [zip, setZip] = useState(initialZip?.trim().slice(0, 10) ?? "");
  const [err, setErr] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const normalized = zip.trim();
    if (!/^\d{5}(-\d{4})?$/.test(normalized)) {
      setErr("Enter a valid U.S. ZIP code (5 digits or ZIP+4).");
      return;
    }
    setErr(null);
    const five = normalized.slice(0, 5);
    router.push(`/?zip=${encodeURIComponent(five)}#featured-trainers`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto mt-6 max-w-sm space-y-3">
      <label className="block text-left text-xs font-bold uppercase tracking-wide text-white/45">
        Your ZIP code
        <input
          type="text"
          inputMode="numeric"
          autoComplete="postal-code"
          value={zip}
          onChange={(e) => {
            setZip(e.target.value);
            setErr(null);
          }}
          placeholder="12345"
          maxLength={10}
          className="mt-2 w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-[#FF7E00]/55"
        />
      </label>
      {err ? (
        <p className="text-left text-xs text-[#FFB4B4]" role="alert">
          {err}
        </p>
      ) : null}
      <button
        type="submit"
        className="w-full rounded-xl border border-[#FF7E00]/45 bg-[#FF7E00]/16 py-3 text-xs font-black uppercase tracking-[0.1em] text-white transition hover:border-[#FF7E00]/58"
      >
        Show Featured Coaches
      </button>
    </form>
  );
}
