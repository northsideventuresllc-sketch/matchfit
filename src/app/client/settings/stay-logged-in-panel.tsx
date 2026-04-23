"use client";

import { useState } from "react";

export function StayLoggedInPanel(props: { initialStayLoggedIn: boolean }) {
  const [value, setValue] = useState(props.initialStayLoggedIn);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function apply(next: boolean) {
    const prev = value;
    setValue(next);
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/client/settings/session", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stayLoggedIn: next }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setValue(prev);
        setError(data.error ?? "Could not update preference.");
        return;
      }
      setMessage("Saved.");
    } catch {
      setValue(prev);
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-3xl border border-white/[0.08] bg-[#12151C]/90 p-6 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.85)] backdrop-blur-xl sm:p-8">
      <h2 className="text-lg font-black tracking-tight text-white">Sessions</h2>
      <p className="mt-2 text-sm leading-relaxed text-white/55">
        When this is on, your browser keeps you signed in longer. Turn it off on shared computers.
      </p>
      {error ? (
        <p className="mt-4 rounded-xl border border-[#E32B2B]/35 bg-[#E32B2B]/10 px-4 py-3 text-sm text-[#FFB4B4]" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="mt-4 text-sm text-[#B8F0C8]" role="status">
          {message}
        </p>
      ) : null}
      <label className="mt-6 flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={value}
          disabled={busy}
          onChange={(e) => void apply(e.target.checked)}
          className="mt-1 h-4 w-4 shrink-0 accent-[#FF7E00] focus:ring-2 focus:ring-[#FF7E00]/40 focus:ring-offset-0 disabled:opacity-50"
        />
        <span className="text-sm leading-relaxed text-white/70">Stay logged in on this device</span>
      </label>
    </div>
  );
}
