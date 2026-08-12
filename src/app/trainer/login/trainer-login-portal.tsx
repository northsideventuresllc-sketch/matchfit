"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import {
  MatchFitBrandPageBackground,
  matchFitAuthCardClass,
  matchFitBrandPageMainClass,
} from "@/components/match-fit-brand-page-background";
import { MatchFitGradientButton } from "@/components/match-fit-gradient-cta";
import { MatchFitSocialLinks } from "@/components/match-fit-social-links";
import { TurnstileField } from "@/components/turnstile-field";
import { useTurnstileGate } from "@/hooks/use-turnstile-gate";
import { navigateWithFullLoad } from "@/lib/navigate-full-load";
import type { TrainerPostAuthPath } from "@/lib/trainer-post-auth-redirect";

export type TrainerLoginPortalProps = {
  redirectAfterLogin: TrainerPostAuthPath;
  /** `dashboard` = dedicated dashboard sign-in copy; `onboarding` = general trainer portal copy */
  variant?: "dashboard" | "onboarding";
  /** After email link password reset, prompt to sign in with the new password. */
  passwordResetSuccess?: boolean;
};

export default function TrainerLoginPortal({
  redirectAfterLogin,
  variant = "onboarding",
  passwordResetSuccess = false,
}: TrainerLoginPortalProps) {
  const turnstile = useTurnstileGate();
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [stayLoggedIn, setStayLoggedIn] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const tsErr = turnstile.validateBeforeSubmit();
    if (tsErr) {
      setError(tsErr);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/trainer/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier,
          password,
          stayLoggedIn,
          redirectAfterLogin,
          ...turnstile.turnstileField(),
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        needsTwoFactor?: boolean;
        next?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Could Not Sign You In.");
        turnstile.reset();
        return;
      }
      if (data.needsTwoFactor) {
        router.push(data.next ?? "/verify-2fa");
        return;
      }
      // Full navigation avoids App Router races; defer so React/Next finish this commit (prevents stuck dark overlay).
      navigateWithFullLoad(data.next ?? "/trainer/dashboard");
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={matchFitBrandPageMainClass}>
      <MatchFitBrandPageBackground />

      <div className="relative z-10 mx-auto flex min-h-svh max-w-lg flex-col px-5 pb-16 pt-10 sm:px-8 sm:pb-20 sm:pt-14">
        <header className="flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3 opacity-90 transition hover:opacity-100">
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl sm:h-14 sm:w-14">
              <Image src="/logo.png" alt="Match Fit" fill className="object-contain" sizes="56px" />
            </div>
            <div className="leading-none">
              <p className="text-sm font-black tracking-tight sm:text-base">
                <span className="text-[#E8EAEF]">Match</span> <span className="text-[#E32B2B]">Fit</span>
              </p>
            </div>
          </Link>
        </header>

        <div className="mt-12 flex flex-1 flex-col sm:mt-16">
          <h1 className="text-center text-2xl font-black tracking-tight text-white sm:text-3xl">
            {variant === "dashboard" ? "Fitness Pro Dashboard" : "Fitness Pro Portal"}
          </h1>
          <p className="mx-auto mt-3 max-w-md text-center text-sm leading-relaxed text-white/55 sm:text-base">
            {variant === "dashboard"
              ? "Sign in to open your Fitness Pro dashboard. Two-factor authentication uses the same secure delivery channels as client accounts."
              : "Sign in to continue onboarding. Two-factor authentication uses the same secure delivery channels as client accounts."}
          </p>

          <div className="mx-auto mt-10 w-full max-w-md">
            <div className={matchFitAuthCardClass}>
              {error ? (
                <p
                  className="mb-4 rounded-xl border border-[#E32B2B]/35 bg-[#E32B2B]/10 px-4 py-3 text-sm text-[#FFB4B4]"
                  role="alert"
                >
                  {error}
                </p>
              ) : null}
              {passwordResetSuccess ? (
                <p
                  className="mb-4 rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100"
                  role="status"
                >
                  Your password was updated. Sign in with your new password.
                </p>
              ) : null}
              <form onSubmit={handleLogin} className="flex flex-col gap-5">
                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="trainer-identifier"
                    className="text-xs font-semibold uppercase tracking-wide text-white/50"
                  >
                    Username, email, or phone
                  </label>
                  <input
                    id="trainer-identifier"
                    name="identifier"
                    type="text"
                    autoComplete="username"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="you@email.com or @username"
                    className="rounded-xl border border-white/10 bg-[#0E1016] px-4 py-3 text-[15px] text-white outline-none ring-[#FF7E00]/40 transition placeholder:text-white/25 focus:border-[#FF7E00]/40 focus:ring-2"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="trainer-password"
                    className="text-xs font-semibold uppercase tracking-wide text-white/50"
                  >
                    Password
                  </label>
                  <input
                    id="trainer-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="rounded-xl border border-white/10 bg-[#0E1016] px-4 py-3 text-[15px] text-white outline-none ring-[#FF7E00]/40 transition placeholder:text-white/25 focus:border-[#FF7E00]/40 focus:ring-2"
                  />
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-white/50">
                    <input
                      type="checkbox"
                      checked={showPassword}
                      onChange={(e) => setShowPassword(e.target.checked)}
                      className="h-4 w-4 shrink-0 accent-[#FF7E00] focus:ring-2 focus:ring-[#FF7E00]/40 focus:ring-offset-0"
                    />
                    <span>Show password</span>
                  </label>
                  <Link
                    href="/trainer/forgot-password"
                    className="mt-1 self-start text-xs font-semibold text-[#FF7E00] underline-offset-2 hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>

                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/[0.06] bg-[#0E1016]/80 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={stayLoggedIn}
                    onChange={(e) => setStayLoggedIn(e.target.checked)}
                    className="mt-1 h-4 w-4 shrink-0 accent-[#FF7E00] focus:ring-2 focus:ring-[#FF7E00]/40 focus:ring-offset-0"
                  />
                  <span className="text-sm leading-relaxed text-white/65">
                    Stay logged in on this device (longer session).
                  </span>
                </label>

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

                <MatchFitGradientButton type="submit" disabled={busy} className="mt-1">
                  {busy ? "Signing in…" : "Continue"}
                </MatchFitGradientButton>
              </form>

              <div className="relative my-8 flex items-center gap-4">
                <span className="h-px flex-1 bg-white/10" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-white/35">New Fitness Pro?</span>
                <span className="h-px flex-1 bg-white/10" />
              </div>

              <Link
                href="/trainer/signup"
                className="flex min-h-[3.25rem] w-full items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] px-4 text-sm font-black uppercase tracking-[0.08em] text-white transition hover:border-white/25 hover:bg-white/[0.07]"
              >
                Create Fitness Pro Account
              </Link>
            </div>

            <MatchFitSocialLinks variant="compact" className="mt-8" />

            <p className="mt-6 text-center text-xs leading-relaxed text-white/35">
              <Link
                href="/admin/login"
                className="text-white/50 underline-offset-4 transition hover:text-white/70 hover:underline"
              >
                Administrator Log In
              </Link>
              {" · "}
              <Link
                href="/"
                className="text-white/50 underline-offset-4 transition hover:text-white/70 hover:underline"
              >
                Back to Home
              </Link>
              {" · "}
              <Link
                href="/client"
                className="text-white/50 underline-offset-4 transition hover:text-white/70 hover:underline"
              >
                Client Portal
              </Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
