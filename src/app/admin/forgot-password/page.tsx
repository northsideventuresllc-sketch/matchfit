"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { TurnstileField } from "@/components/turnstile-field";
import { AdminPrimaryButton, adminInputClass } from "@/components/admin/admin-portal-ui";
import {
  adminPortalBackgroundLayers,
  adminPortalLinkClass,
  adminPortalMainClass,
} from "@/components/admin/admin-portal-styles";
import { useTurnstileGate } from "@/hooks/use-turnstile-gate";
import { MATCH_FIT_SUPPORT_MAILTO } from "@/lib/match-fit-support-contact";

export default function AdminForgotPasswordPage() {
  const turnstile = useTurnstileGate();
  const [adminCode, setAdminCode] = useState("");
  const [email, setEmail] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const tsErr = turnstile.validateBeforeSubmit();
    if (tsErr) {
      setError(tsErr);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/forgot-password/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminCode: adminCode.trim(),
          email: email.trim(),
          dateOfBirth,
          ...turnstile.turnstileField(),
        }),
      });
      const data = (await res.json()) as { error?: string };
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
    <main className={adminPortalMainClass}>
      <div aria-hidden className={adminPortalBackgroundLayers.warmGlow} />
      <div aria-hidden className={adminPortalBackgroundLayers.vignette} />
      <div className="relative z-10 mx-auto flex min-h-svh max-w-lg flex-col px-5 pb-16 pt-10 sm:px-8 sm:pb-20 sm:pt-14">
        <Link href="/admin/login" className="text-xs font-semibold uppercase tracking-wide text-white/45 hover:text-white/70">
          ← Back to Administrator Portal
        </Link>
        <h1 className="mt-8 text-2xl font-black tracking-tight text-white sm:text-3xl">Forgot Your Password?</h1>
        <p className="mt-3 text-sm leading-relaxed text-white/55">
          Enter your administrator code, email, and date of birth. If everything matches, we&apos;ll email a reset link
          to the address on file. If any of it doesn&apos;t match, nothing is sent.
        </p>

        {sent ? (
          <div className="mt-8 rounded-2xl border border-emerald-500/35 bg-emerald-500/10 px-5 py-5">
            <p className="text-sm leading-relaxed text-emerald-100/90">
              If those details match an administrator account, a reset link is on its way to the email on file.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5" noValidate>
            {error ? (
              <p className="rounded-xl border border-[#E32B2B]/35 bg-[#E32B2B]/10 px-4 py-3 text-sm text-[#FFB4B4]" role="alert">
                {error}
              </p>
            ) : null}
            <div className="flex flex-col gap-2">
              <label htmlFor="afp-code" className="text-xs font-semibold uppercase tracking-wide text-white/50">
                Administrator code
              </label>
              <input
                id="afp-code"
                value={adminCode}
                onChange={(e) => setAdminCode(e.target.value.toLowerCase())}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                maxLength={24}
                className={`${adminInputClass} font-mono tracking-wide`}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="afp-email" className="text-xs font-semibold uppercase tracking-wide text-white/50">
                Email
              </label>
              <input id="afp-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={adminInputClass} required />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="afp-dob" className="text-xs font-semibold uppercase tracking-wide text-white/50">
                Date of birth
              </label>
              <input
                id="afp-dob"
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                className={`${adminInputClass} [color-scheme:dark]`}
                required
              />
            </div>

            <TurnstileField
              enabled={turnstile.enabled}
              widgetRef={turnstile.ref}
              siteKey={turnstile.siteKey}
              onReady={turnstile.onTurnstileReady}
              onError={turnstile.onTurnstileError}
              onExpire={turnstile.onTurnstileExpire}
              widgetError={turnstile.widgetError}
              ready={turnstile.ready}
            />

            <AdminPrimaryButton type="submit" disabled={busy || (turnstile.enabled && !turnstile.ready)}>
              {busy ? "Checking…" : "Send Reset Link"}
            </AdminPrimaryButton>
          </form>
        )}

        <p className="mt-8 text-xs leading-relaxed text-white/40">
          Need another way in?{" "}
          <a href={MATCH_FIT_SUPPORT_MAILTO.accountAccess} className={adminPortalLinkClass}>
            Contact support
          </a>
          .
        </p>
      </div>
    </main>
  );
}
