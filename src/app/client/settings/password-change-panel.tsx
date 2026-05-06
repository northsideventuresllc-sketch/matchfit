"use client";

import { FormEvent, useState } from "react";
import { navigateWithFullLoad } from "@/lib/navigate-full-load";
import { describePasswordPolicyViolations } from "@/lib/validations/client-register";

const inputClass =
  "w-full rounded-xl border border-white/10 bg-[#0E1016] px-4 py-3 text-[15px] text-white outline-none ring-[#FF7E00]/40 transition placeholder:text-white/25 focus:border-[#FF7E00]/40 focus:ring-2";

export function PasswordChangePanel(props: {
  twoFactorEnabled: boolean;
  unstyled?: boolean;
  /** Base path without trailing slash; defaults to client settings API. */
  apiBase?: string;
}) {
  const apiBase = props.apiBase ?? "/api/client/settings";
  const [phase, setPhase] = useState<"idle" | "otp" | "email">("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [devPhoneMockTip, setDevPhoneMockTip] = useState(false);

  async function handleStart() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`${apiBase}/password-change/start`, { method: "POST" });
      const data = (await res.json()) as { error?: string; flow?: "otp" | "email"; devPhoneMock?: boolean };
      if (!res.ok) {
        setError(data.error ?? "Could not start password change.");
        return;
      }
      setDevPhoneMockTip(Boolean(data.devPhoneMock));
      if (data.flow === "otp") {
        setPhase("otp");
        setCode("");
        setNewPassword("");
        setConfirmPassword("");
      } else if (data.flow === "email") {
        setPhase("email");
      }
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCompleteOtp(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit code.");
      return;
    }
    const pwMsg = describePasswordPolicyViolations(newPassword);
    if (pwMsg) {
      setError(pwMsg);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`${apiBase}/password-change/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "otp", code, newPassword }),
      });
      const data = (await res.json()) as { error?: string; next?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not update password.");
        return;
      }
      navigateWithFullLoad(data.next ?? "/client?passwordReset=1");
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function handleResetIdle() {
    setPhase("idle");
    setError(null);
    setCode("");
    setNewPassword("");
    setConfirmPassword("");
    setDevPhoneMockTip(false);
  }

  const shell = props.unstyled
    ? "space-y-4"
    : "rounded-3xl border border-white/[0.08] bg-[#12151C]/90 p-6 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.85)] backdrop-blur-xl sm:p-8";

  return (
    <div className={shell}>
      {props.unstyled ? null : (
        <div className="text-center">
          <h2 className="text-lg font-black tracking-tight text-white">Password</h2>
          <p className="mt-2 text-sm leading-relaxed text-white/55">
            {props.twoFactorEnabled
              ? "We will send a verification code to your 2FA method. Enter it here with your new password."
              : "We will email you a secure link. Open it to choose a new password, then sign in again."}
          </p>
        </div>
      )}

      {error ? (
        <p className="mt-4 rounded-xl border border-[#E32B2B]/35 bg-[#E32B2B]/10 px-4 py-3 text-sm text-[#FFB4B4]" role="alert">
          {error}
        </p>
      ) : null}

      {phase === "idle" ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleStart()}
          className="mt-6 w-full rounded-xl border border-white/15 bg-white/[0.06] px-4 py-3 text-sm font-black uppercase tracking-[0.08em] text-white transition hover:border-white/25 disabled:opacity-50"
        >
          {busy ? "Please wait…" : "Change password"}
        </button>
      ) : null}

      {phase === "email" ? (
        <div className="mt-6 space-y-4">
          <p className="text-sm text-white/65">
            Check your email for a link to reset your password. The link expires in one hour. After you finish, sign
            in on this page using your new password.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={handleResetIdle}
            className="text-xs font-semibold uppercase tracking-wide text-white/45 hover:text-white/70"
          >
            Back
          </button>
        </div>
      ) : null}

      {phase === "otp" ? (
        <form onSubmit={handleCompleteOtp} className="mt-6 flex flex-col gap-4">
          {devPhoneMockTip ? (
            <p
              className="rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-4 py-3 text-sm leading-relaxed text-emerald-100"
              role="status"
            >
              Development mode: your 2FA code was not sent by SMS or voice. Check the terminal where{" "}
              <span className="font-mono text-emerald-50">npm run dev</span> is running for the 6-digit code.
            </p>
          ) : null}
          <div className="flex flex-col gap-2">
            <label htmlFor="pwd-code" className="text-xs font-semibold uppercase tracking-wide text-white/50">
              Verification code
            </label>
            <input
              id="pwd-code"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className={inputClass}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="pwd-new" className="text-xs font-semibold uppercase tracking-wide text-white/50">
                New password
              </label>
              <button
                type="button"
                className="text-xs font-semibold text-[#FF7E00]/90 hover:text-[#FF7E00]"
                onClick={() => setShowNew((s) => !s)}
              >
                {showNew ? "Hide" : "Show"}
              </button>
            </div>
            <input
              id="pwd-new"
              type={showNew ? "text" : "password"}
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={inputClass}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="pwd-confirm" className="text-xs font-semibold uppercase tracking-wide text-white/50">
                Confirm new password
              </label>
              <button
                type="button"
                className="text-xs font-semibold text-[#FF7E00]/90 hover:text-[#FF7E00]"
                onClick={() => setShowConfirm((s) => !s)}
              >
                {showConfirm ? "Hide" : "Show"}
              </button>
            </div>
            <input
              id="pwd-confirm"
              type={showConfirm ? "text" : "password"}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={inputClass}
              required
            />
          </div>
          <p className="text-xs text-white/40">Use at least 8 characters, one capital letter, and one special character.</p>
          <button
            type="submit"
            disabled={busy}
            className="group relative isolate flex min-h-[3rem] w-full items-center justify-center overflow-hidden rounded-xl px-4 text-sm font-black uppercase tracking-[0.08em] text-[#0B0C0F] shadow-[0_20px_50px_-18px_rgba(227,43,43,0.45)] transition disabled:opacity-50"
          >
            <span aria-hidden className="absolute inset-0 bg-[linear-gradient(135deg,#FFD34E_0%,#FF7E00_45%,#E32B2B_100%)]" />
            <span className="relative">{busy ? "Updating…" : "Update password"}</span>
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={handleResetIdle}
            className="text-xs font-semibold uppercase tracking-wide text-white/45 hover:text-white/70"
          >
            Cancel
          </button>
        </form>
      ) : null}
    </div>
  );
}
