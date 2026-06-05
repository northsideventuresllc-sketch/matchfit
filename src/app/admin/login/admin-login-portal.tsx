"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { TurnstileField } from "@/components/turnstile-field";
import {
  AdminPortalBackdrop,
  AdminPortalBetaNotice,
  AdminPortalLogoLink,
  AdminPrimaryButton,
  adminInputClass,
  adminLabelClass,
  adminLinkClass,
  adminPanelClass,
} from "@/components/admin/admin-portal-ui";
import { useTurnstileGate } from "@/hooks/use-turnstile-gate";
import { navigateWithFullLoad } from "@/lib/navigate-full-load";

export default function AdminLoginPortal() {
  const turnstile = useTurnstileGate();
  const [adminCode, setAdminCode] = useState("");
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
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          adminCode: adminCode.trim(),
          password,
          stayLoggedIn,
          ...turnstile.turnstileField(),
        }),
      });
      const data = (await res.json()) as { error?: string; next?: string };
      if (!res.ok) {
        const msg = data.error ?? "Could Not Sign You In.";
        setError(
          res.status === 401
            ? `${msg} Check your administrator code and password. If this account was removed during testing, it must be recreated.`
            : msg,
        );
        turnstile.reset();
        return;
      }
      navigateWithFullLoad(data.next ?? "/admin");
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative min-h-dvh overflow-x-hidden bg-[#0B0C0F] text-white antialiased">
      <AdminPortalBackdrop />

      <div className="relative z-10 mx-auto flex min-h-dvh max-w-lg flex-col px-5 pb-16 pt-10 sm:px-8 sm:pb-20 sm:pt-14">
        <header className="flex items-center justify-between gap-4">
          <AdminPortalLogoLink />
        </header>

        <div className="mt-12 flex flex-1 flex-col sm:mt-16">
          <h1 className="text-center text-2xl font-black tracking-tight text-white sm:text-3xl">Administrator Portal</h1>
          <p className="mx-auto mt-3 max-w-md text-center text-sm leading-relaxed text-white/55 sm:text-base">
            Sign in with your eight-character administrator code and password. This area is restricted to authorized Match Fit
            personnel.
          </p>
          <AdminPortalBetaNotice className="mx-auto mt-4 max-w-lg text-center" />

          <div className="mx-auto mt-10 w-full max-w-md">
            <div className={`rounded-3xl ${adminPanelClass} p-6 shadow-[0_30px_80px_-40px_rgba(227,43,43,0.55)] sm:p-8`}>
              {error ? (
                <p
                  className="mb-4 rounded-xl border border-[#E32B2B]/35 bg-[#E32B2B]/10 px-4 py-3 text-sm text-[#FFB4B4]"
                  role="alert"
                >
                  {error}
                </p>
              ) : null}

              <form onSubmit={(e) => void handleLogin(e)} className="flex flex-col gap-5">
                <div className="flex flex-col gap-2">
                  <label htmlFor="admin-code" className={adminLabelClass}>
                    Administrator code
                  </label>
                  <input
                    id="admin-code"
                    autoComplete="username"
                    value={adminCode}
                    onChange={(e) => setAdminCode(e.target.value.toLowerCase())}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    maxLength={24}
                    className={`${adminInputClass} font-mono tracking-wide`}
                    placeholder="8-character code (not email)"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label htmlFor="admin-password" className={adminLabelClass}>
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="admin-password"
                      autoComplete="current-password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={`${adminInputClass} pr-24`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-white/45 hover:text-white/75"
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>

                <label className="flex cursor-pointer items-center gap-3 text-sm text-white/65">
                  <input
                    type="checkbox"
                    checked={stayLoggedIn}
                    onChange={(e) => setStayLoggedIn(e.target.checked)}
                    className="h-4 w-4 rounded border-white/20 bg-[#0E1016] accent-[#FF7E00]"
                  />
                  Stay signed in on this device
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
                />

                <AdminPrimaryButton
                  type="submit"
                  disabled={busy || (turnstile.enabled && !turnstile.ready)}
                  className="mt-1"
                >
                  {busy ? "Signing in…" : turnstile.enabled && !turnstile.ready ? "Complete security check…" : "Continue"}
                </AdminPrimaryButton>
              </form>

              <p className="mt-8 text-center text-xs leading-relaxed text-white/40">
                Need access?{" "}
                <Link href="/admin/sign-up" className={adminLinkClass}>
                  Request an administrator account
                </Link>
              </p>
            </div>

            <p className="mt-8 text-center text-xs leading-relaxed text-white/35">
              <Link
                href="/admin/login"
                className="text-white/50 underline-offset-4 transition hover:text-white/70 hover:underline"
              >
                Administrator Log In
              </Link>
              <span className="mx-2 text-white/25">·</span>
              <Link href="/" className="text-white/50 underline-offset-4 transition hover:text-white/70 hover:underline">
                Back to Home
              </Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
