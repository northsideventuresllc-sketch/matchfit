"use client";

import Link from "next/link";
import { useState } from "react";

type Channel = "EMAIL" | "SMS" | "VOICE";

const inputClass =
  "w-full rounded-xl border border-white/10 bg-[#0E1016] px-4 py-3 text-[15px] text-white outline-none ring-[#FF7E00]/40 transition placeholder:text-white/25 focus:border-[#FF7E00]/40 focus:ring-2";

export function TwoFactorPanel(props: {
  initialEnabled: boolean;
  initialMethod: string;
}) {
  const [enabled, setEnabled] = useState(props.initialEnabled);
  const [method, setMethod] = useState(props.initialMethod);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [disablePassword, setDisablePassword] = useState("");
  const [showDisablePw, setShowDisablePw] = useState(false);
  const [enablePassword, setEnablePassword] = useState("");
  const [showEnablePw, setShowEnablePw] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<Channel>("EMAIL");
  const [phase, setPhase] = useState<"idle" | "code">("idle");
  const [code, setCode] = useState("");

  async function handleDisable(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/client/settings/2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disable", password: disablePassword }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not turn off 2FA.");
        return;
      }
      setEnabled(false);
      setMethod("NONE");
      setDisablePassword("");
      setPhase("idle");
      setCode("");
    } finally {
      setBusy(false);
    }
  }

  async function handleRequestEnable(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/client/settings/2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "request_enable",
          password: enablePassword,
          method: selectedChannel,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not send a code.");
        return;
      }
      setPhase("code");
      setCode("");
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmEnable(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit code.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/client/settings/2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirm_enable", code }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Verification failed.");
        return;
      }
      setEnabled(true);
      setMethod(selectedChannel);
      setPhase("idle");
      setEnablePassword("");
      setCode("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-3xl border border-white/[0.08] bg-[#12151C]/90 p-6 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.85)] backdrop-blur-xl sm:p-8">
      <h2 className="text-lg font-black tracking-tight text-white">Two-factor authentication</h2>
      <p className="mt-2 text-sm leading-relaxed text-white/55">
        Turn 2FA on to require a code from your email, a text, or a phone call when signing in from a new device. You
        can turn it off anytime with your password. Codes are only sent through providers you configure in production.
      </p>

      {error ? (
        <p className="mt-4 rounded-xl border border-[#E32B2B]/35 bg-[#E32B2B]/10 px-4 py-3 text-sm text-[#FFB4B4]" role="alert">
          {error}
        </p>
      ) : null}

      {enabled ? (
        <form onSubmit={handleDisable} className="mt-6 flex flex-col gap-4">
          <p className="text-sm text-white/60">
            Status: <span className="font-semibold text-white">On</span> ({method})
          </p>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="disable-pw" className="text-xs font-semibold uppercase tracking-wide text-white/50">
                Password to confirm
              </label>
              <button
                type="button"
                className="text-xs font-semibold text-[#FF7E00]/90 hover:text-[#FF7E00]"
                onClick={() => setShowDisablePw((s) => !s)}
              >
                {showDisablePw ? "Hide" : "Show"}
              </button>
            </div>
            <input
              id="disable-pw"
              type={showDisablePw ? "text" : "password"}
              autoComplete="current-password"
              value={disablePassword}
              onChange={(e) => setDisablePassword(e.target.value)}
              className={inputClass}
              required
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="min-h-[3rem] rounded-xl border border-white/15 bg-white/[0.06] px-4 text-sm font-black uppercase tracking-[0.08em] text-white transition hover:border-white/25 disabled:opacity-50"
          >
            {busy ? "Please wait…" : "Turn off two-factor authentication"}
          </button>
        </form>
      ) : phase === "idle" ? (
        <form onSubmit={handleRequestEnable} className="mt-6 flex flex-col gap-4">
          <p className="text-sm text-white/60">
            Status: <span className="font-semibold text-white/80">Off</span>
          </p>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="enable-pw" className="text-xs font-semibold uppercase tracking-wide text-white/50">
                Password to continue
              </label>
              <button
                type="button"
                className="text-xs font-semibold text-[#FF7E00]/90 hover:text-[#FF7E00]"
                onClick={() => setShowEnablePw((s) => !s)}
              >
                {showEnablePw ? "Hide" : "Show"}
              </button>
            </div>
            <input
              id="enable-pw"
              type={showEnablePw ? "text" : "password"}
              autoComplete="current-password"
              value={enablePassword}
              onChange={(e) => setEnablePassword(e.target.value)}
              className={inputClass}
              required
            />
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide text-white/50">Delivery method</p>
          <div className="flex flex-col gap-2">
            {(
              [
                { id: "EMAIL" as const, label: "Email" },
                { id: "SMS" as const, label: "Text message" },
                { id: "VOICE" as const, label: "Phone call" },
              ] as const
            ).map((c) => (
              <label
                key={c.id}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm ${
                  selectedChannel === c.id ? "border-[#FF7E00]/60 bg-[#FF7E00]/10" : "border-white/10 bg-[#0E1016]"
                }`}
              >
                <input
                  type="radio"
                  name="ch"
                  checked={selectedChannel === c.id}
                  onChange={() => setSelectedChannel(c.id)}
                  className="accent-[#FF7E00]"
                />
                {c.label}
              </label>
            ))}
          </div>
          <button
            type="submit"
            disabled={busy}
            className="group relative isolate mt-1 flex min-h-[3rem] w-full items-center justify-center overflow-hidden rounded-xl px-4 text-sm font-black uppercase tracking-[0.08em] text-[#0B0C0F] shadow-[0_20px_50px_-18px_rgba(227,43,43,0.45)] transition disabled:opacity-50"
          >
            <span
              aria-hidden
              className="absolute inset-0 bg-[linear-gradient(135deg,#FFD34E_0%,#FF7E00_45%,#E32B2B_100%)]"
            />
            <span className="relative">{busy ? "Please wait…" : "Send verification code"}</span>
          </button>
        </form>
      ) : (
        <form onSubmit={handleConfirmEnable} className="mt-6 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="enable-code" className="text-xs font-semibold uppercase tracking-wide text-white/50">
              Verification code
            </label>
            <input
              id="enable-code"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className={inputClass}
              required
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="group relative isolate flex min-h-[3rem] w-full items-center justify-center overflow-hidden rounded-xl px-4 text-sm font-black uppercase tracking-[0.08em] text-[#0B0C0F] shadow-[0_20px_50px_-18px_rgba(227,43,43,0.45)] transition disabled:opacity-50"
          >
            <span
              aria-hidden
              className="absolute inset-0 bg-[linear-gradient(135deg,#FFD34E_0%,#FF7E00_45%,#E32B2B_100%)]"
            />
            <span className="relative">{busy ? "Please wait…" : "Verify and turn on 2FA"}</span>
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setPhase("idle");
              setCode("");
              setError(null);
            }}
            className="text-xs font-semibold uppercase tracking-wide text-white/40 hover:text-white/65"
          >
            Back
          </button>
        </form>
      )}

      <p className="mt-8 text-sm">
        <Link href="/client/account" className="text-[#FF7E00] underline-offset-2 hover:underline">
          Back to account
        </Link>
      </p>
    </div>
  );
}
