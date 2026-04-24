"use client";

import { FormEvent, useState } from "react";

export function TrainerComplianceW9EmailSelfService() {
  const [phase, setPhase] = useState<"idle" | "sent" | "done">("idle");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/trainer/compliance/w9-email/start", { method: "POST", credentials: "include" });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not send code.");
        return;
      }
      setPhase("sent");
      setCode("");
    } catch {
      setError("Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function complete(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/trainer/compliance/w9-email/complete", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not send email.");
        return;
      }
      setPhase("done");
    } catch {
      setError("Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  if (phase === "done") {
    return (
      <p className="text-sm text-emerald-200/90">
        A copy of your W-9 details was sent to your Match Fit account email.
      </p>
    );
  }

  if (phase === "sent") {
    return (
      <form onSubmit={complete} className="space-y-3">
        <p className="text-sm text-white/60">
          Enter the 6-digit code we sent to your account email. After you verify, we will email your W-9 information
          to that same address.
        </p>
        <input
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="000000"
          className="w-full max-w-[12rem] rounded-xl border border-white/10 bg-[#0E1016] px-4 py-3 text-center text-lg tracking-[0.35em] text-white outline-none ring-[#FF7E00]/40 focus:border-[#FF7E00]/40 focus:ring-2"
          disabled={busy}
        />
        {error ? <p className="text-xs text-[#FFB4B4]">{error}</p> : null}
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={busy || code.length !== 6}
            className="rounded-xl border border-white/15 bg-white/[0.08] px-4 py-2.5 text-xs font-black uppercase tracking-[0.08em] text-white transition hover:border-white/25 disabled:opacity-50"
          >
            {busy ? "Sending…" : "Send W-9 Email"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setPhase("idle");
              setCode("");
              setError(null);
            }}
            className="rounded-xl border border-white/10 px-4 py-2.5 text-xs font-semibold text-white/55 transition hover:text-white/80"
          >
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-white/55">
        We will send a verification code to your account email, then email your W-9 details to that address.
      </p>
      {error ? <p className="text-xs text-[#FFB4B4]">{error}</p> : null}
      <button
        type="button"
        disabled={busy}
        onClick={() => void start()}
        className="rounded-xl border border-[#FF7E00]/35 bg-[#FF7E00]/10 px-4 py-2.5 text-xs font-black uppercase tracking-[0.08em] text-white transition hover:border-[#FF7E00]/50 disabled:opacity-50"
      >
        {busy ? "Sending code…" : "Email W-9 to My Account Email"}
      </button>
    </div>
  );
}
