"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useRef, useState } from "react";
import { TurnstileWidget, type TurnstileWidgetHandle } from "@/components/turnstile-widget";
import { safeInternalNextPath } from "@/lib/safe-internal-next-path";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

function ClientPortalInner(props: { defaultNext: string | null }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const showPasswordResetBanner = searchParams.get("passwordReset") === "1";
  const safeNext =
    safeInternalNextPath(searchParams.get("next")) ?? safeInternalNextPath(props.defaultNext) ?? null;

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [stayLoggedIn, setStayLoggedIn] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const turnstileRef = useRef<TurnstileWidgetHandle>(null);

  async function handleLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (TURNSTILE_SITE_KEY) {
      const token = turnstileRef.current?.getToken();
      if (!token) {
        setError("Please wait for the security check to finish, then try again.");
        return;
      }
    }
    setBusy(true);
    try {
      const turnstileToken = TURNSTILE_SITE_KEY ? turnstileRef.current?.getToken() : undefined;
      const res = await fetch("/api/client/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password, stayLoggedIn, ...(turnstileToken ? { turnstileToken } : {}) }),
      });
      const data = (await res.json()) as { error?: string; needsTwoFactor?: boolean; next?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not sign you in.");
        turnstileRef.current?.reset();
        return;
      }
      if (data.needsTwoFactor) {
        const base = data.next ?? "/client/verify-2fa";
        const q = safeNext ? `?next=${encodeURIComponent(safeNext)}` : "";
        router.push(`${base}${q}`);
        return;
      }
      router.push(safeNext ?? "/client/dashboard");
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative min-h-dvh overflow-x-hidden bg-[#0B0C0F] text-white antialiased">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(255,211,78,0.14),transparent_55%),radial-gradient(ellipse_90%_60%_at_100%_0%,rgba(255,126,0,0.1),transparent_50%),radial-gradient(ellipse_70%_50%_at_0%_100%,rgba(227,43,43,0.08),transparent_55%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(45,52,64,0.35)_0%,transparent_40%,transparent_75%,rgba(11,12,15,0.92)_100%)]"
      />

      <div className="relative z-10 mx-auto flex min-h-dvh max-w-lg flex-col px-5 pb-16 pt-10 sm:px-8 sm:pb-20 sm:pt-14">
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
          <h1 className="text-center text-2xl font-black tracking-tight text-white sm:text-3xl">Client Portal</h1>
          <p className="mx-auto mt-3 max-w-md text-center text-sm leading-relaxed text-white/55 sm:text-base">
            Log in with your existing account, or create a new one to get started.
          </p>

          <div className="mx-auto mt-10 w-full max-w-md">
            <div className="rounded-3xl border border-white/[0.08] bg-[#12151C]/90 p-6 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.85)] backdrop-blur-xl sm:p-8">
              {showPasswordResetBanner ? (
                <p
                  className="mb-4 rounded-xl border border-[#2A7A4B]/40 bg-[#2A7A4B]/15 px-4 py-3 text-sm text-[#B8F0C8]"
                  role="status"
                >
                  Log in with your new password.
                </p>
              ) : null}
              {error ? (
                <p
                  className="mb-4 rounded-xl border border-[#E32B2B]/35 bg-[#E32B2B]/10 px-4 py-3 text-sm text-[#FFB4B4]"
                  role="alert"
                >
                  {error}
                </p>
              ) : null}
              <form onSubmit={handleLogin} className="flex flex-col gap-5">
                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="client-identifier"
                    className="text-xs font-semibold uppercase tracking-wide text-white/50"
                  >
                    Username, email, or phone
                  </label>
                  <input
                    id="client-identifier"
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
                    htmlFor="client-password"
                    className="text-xs font-semibold uppercase tracking-wide text-white/50"
                  >
                    Password
                  </label>
                  <input
                    id="client-password"
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
                </div>

                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/[0.06] bg-[#0E1016]/80 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={stayLoggedIn}
                    onChange={(e) => setStayLoggedIn(e.target.checked)}
                    className="mt-1 h-4 w-4 shrink-0 accent-[#FF7E00] focus:ring-2 focus:ring-[#FF7E00]/40 focus:ring-offset-0"
                  />
                  <span className="text-sm leading-relaxed text-white/65">
                    Stay logged in on this device (longer session). You can change this anytime in Account Settings.
                  </span>
                </label>

                {TURNSTILE_SITE_KEY ? (
                  <div className="flex justify-center pt-1">
                    <TurnstileWidget ref={turnstileRef} siteKey={TURNSTILE_SITE_KEY} />
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={busy}
                  className="group relative isolate mt-1 flex min-h-[3.25rem] w-full items-center justify-center overflow-hidden rounded-xl px-4 text-sm font-black uppercase tracking-[0.08em] text-[#0B0C0F] shadow-[0_20px_50px_-18px_rgba(227,43,43,0.45)] transition active:translate-y-px disabled:opacity-50"
                >
                  <span
                    aria-hidden
                    className="absolute inset-0 bg-[linear-gradient(135deg,#FFD34E_0%,#FF7E00_45%,#E32B2B_100%)]"
                  />
                  <span
                    aria-hidden
                    className="absolute inset-px rounded-[0.65rem] bg-white/10 opacity-0 transition group-hover:opacity-100"
                  />
                  <span className="relative">{busy ? "Signing in…" : "Continue"}</span>
                </button>
              </form>

              <div className="relative my-8 flex items-center gap-4">
                <span className="h-px flex-1 bg-white/10" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-white/35">New here?</span>
                <span className="h-px flex-1 bg-white/10" />
              </div>

              <Link
                href="/client/sign-up"
                className="flex min-h-[3.25rem] w-full items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] px-4 text-sm font-black uppercase tracking-[0.08em] text-white transition hover:border-white/25 hover:bg-white/[0.07]"
              >
                Create Account
              </Link>
            </div>

            <p className="mt-8 text-center text-xs leading-relaxed text-white/35">
              <Link
                href="/"
                className="text-white/50 underline-offset-4 transition hover:text-white/70 hover:underline"
              >
                Back to Home
              </Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function LoginPortal(props: { defaultNext?: string | null }) {
  const defaultNext = props.defaultNext ?? null;
  return (
    <Suspense
      fallback={
        <main className="flex min-h-dvh items-center justify-center bg-[#0B0C0F] px-5 text-sm text-white/50">
          Loading…
        </main>
      }
    >
      <ClientPortalInner defaultNext={defaultNext} />
    </Suspense>
  );
}
