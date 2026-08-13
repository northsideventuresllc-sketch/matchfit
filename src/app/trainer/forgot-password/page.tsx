"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { TurnstileField } from "@/components/turnstile-field";
import { PhoneNumberField, type PhoneNumberValue } from "@/components/phone-number-field";
import { useTurnstileGate } from "@/hooks/use-turnstile-gate";
import { MATCH_FIT_SUPPORT_MAILTO } from "@/lib/match-fit-support-contact";

const inputClass =
  "w-full rounded-xl border border-white/10 bg-[#0E1016] px-4 py-3 text-[15px] text-white outline-none ring-[#FF7E00]/40 transition placeholder:text-white/25 focus:border-[#FF7E00]/40 focus:ring-2";
const labelClass = "text-xs font-semibold uppercase tracking-wide text-white/50";

export default function TrainerForgotPasswordPage() {
  const turnstile = useTurnstileGate();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState<PhoneNumberValue>({ e164: "", isValid: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const canSubmit = username.trim().length > 0 && email.trim().length > 0 && phone.isValid;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!canSubmit) {
      setError("Enter your username, email, and a valid phone number.");
      return;
    }
    const tsErr = turnstile.validateBeforeSubmit();
    if (tsErr) {
      setError(tsErr);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/trainer/forgot-password/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          email: email.trim(),
          phone: phone.e164,
          ...turnstile.turnstileField(),
        }),
      });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Try again.");
        turnstile.reset();
        return;
      }
      setSent(true);
    } catch {
      setError("Something went wrong. Try again.");
      turnstile.reset();
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-dvh bg-[#0B0C0F] px-5 py-12 text-white sm:px-8">
      <div className="mx-auto max-w-md">
        <Link href="/trainer/dashboard/login" className="text-xs font-semibold uppercase tracking-wide text-white/45 hover:text-white/70">
          ← Back to Fitness Pro Sign-In
        </Link>
        <h1 className="mt-6 text-2xl font-black tracking-tight sm:text-3xl">Forgot Your Password?</h1>
        <p className="mt-2 text-sm leading-relaxed text-white/55">
          Enter the username, email, and phone number on your account. If everything matches, we&apos;ll email a reset
          link to the address on file. If any of it doesn&apos;t match, nothing is sent — for your account&apos;s security.
        </p>

        {sent ? (
          <div className="mt-8 rounded-2xl border border-emerald-500/35 bg-emerald-500/10 px-5 py-5">
            <p className="text-sm leading-relaxed text-emerald-100/90">
              If those details match an account, a reset link is on its way to the email on file. Check your inbox
              and spam folder.
            </p>
            <p className="mt-3 text-xs leading-relaxed text-emerald-100/60">
              Still no email after a few minutes, or need help another way?{" "}
              <a href={MATCH_FIT_SUPPORT_MAILTO.accountAccess} className="font-semibold text-[#FF7E00] underline-offset-2 hover:underline">
                Contact support
              </a>
              .
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4" noValidate>
            {error ? (
              <p className="rounded-xl border border-[#E32B2B]/35 bg-[#E32B2B]/10 px-4 py-3 text-sm text-[#FFB4B4]" role="alert">
                {error}
              </p>
            ) : null}
            <div className="flex flex-col gap-2">
              <label htmlFor="fp-username" className={labelClass}>Username</label>
              <input id="fp-username" value={username} onChange={(e) => setUsername(e.target.value)} className={inputClass} required />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="fp-email" className={labelClass}>Email</label>
              <input id="fp-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} required />
            </div>
            <PhoneNumberField id="fp-phone" label="Phone number" required onChange={setPhone} />

            <TurnstileField
              enabled={turnstile.enabled}
              widgetRef={turnstile.ref}
              siteKey={turnstile.siteKey}
              onReady={turnstile.onTurnstileReady}
              onError={turnstile.onTurnstileError}
              onExpire={turnstile.onTurnstileExpire}
              widgetError={turnstile.widgetError}
              ready={turnstile.ready}
              className="flex justify-center pt-1"
            />

            <button
              type="submit"
              disabled={busy || !canSubmit || (turnstile.enabled && !turnstile.ready)}
              className="group relative isolate mt-2 flex min-h-[3rem] w-full items-center justify-center overflow-hidden rounded-xl px-4 text-sm font-black uppercase tracking-[0.08em] text-[#0B0C0F] shadow-[0_20px_50px_-18px_rgba(227,43,43,0.45)] transition disabled:opacity-50"
            >
              <span aria-hidden className="absolute inset-0 bg-[linear-gradient(135deg,#FFD34E_0%,#FF7E00_45%,#E32B2B_100%)]" />
              <span className="relative">{busy ? "Checking…" : "Send Reset Link"}</span>
            </button>

            <p className="mt-2 text-center text-xs leading-relaxed text-white/40">
              Need another way in?{" "}
              <a href={MATCH_FIT_SUPPORT_MAILTO.accountAccess} className="font-semibold text-[#FF7E00] underline-offset-2 hover:underline">
                Contact support
              </a>
              .
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
