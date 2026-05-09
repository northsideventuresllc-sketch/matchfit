"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useRef, useState } from "react";
import { TurnstileWidget, type TurnstileWidgetHandle } from "@/components/turnstile-widget";
import { navigateWithFullLoad } from "@/lib/navigate-full-load";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
/** In development the API often skips Turnstile when `TURNSTILE_SECRET_KEY` is unset; don’t block submit if the widget is slow. */
const TURNSTILE_CLIENT_REQUIRED =
  Boolean(TURNSTILE_SITE_KEY) && process.env.NODE_ENV !== "development";

export default function AdminLoginPortal() {
  const [adminCode, setAdminCode] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [stayLoggedIn, setStayLoggedIn] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const turnstileRef = useRef<TurnstileWidgetHandle>(null);

  async function handleLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (TURNSTILE_CLIENT_REQUIRED) {
      const token = turnstileRef.current?.getToken();
      if (!token) {
        setError("Please wait for the security check to finish, then try again.");
        return;
      }
    }
    setBusy(true);
    try {
      const turnstileToken = TURNSTILE_SITE_KEY ? turnstileRef.current?.getToken() : undefined;
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          adminCode: adminCode.trim(),
          password,
          stayLoggedIn,
          ...(turnstileToken ? { turnstileToken } : {}),
        }),
      });
      const data = (await res.json()) as { error?: string; next?: string };
      if (!res.ok) {
        setError(data.error ?? "Could Not Sign You In.");
        turnstileRef.current?.reset();
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
    <main className="relative min-h-dvh overflow-x-hidden bg-[#050608] text-white antialiased">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_100%_70%_at_50%_-15%,rgba(34,211,238,0.12),transparent_55%),radial-gradient(ellipse_80%_50%_at_100%_0%,rgba(59,130,246,0.08),transparent_50%)]"
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
              <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-300/80">Administrator</p>
            </div>
          </Link>
        </header>

        <div className="mt-12 flex flex-1 flex-col sm:mt-16">
          <h1 className="text-center text-2xl font-black tracking-tight text-white sm:text-3xl">Administrator Portal</h1>
          <p className="mx-auto mt-3 max-w-md text-center text-sm leading-relaxed text-white/55 sm:text-base">
            Sign in with your eight-character administrator code and password. This area is restricted to authorized Match Fit
            personnel.
          </p>
          <p className="mx-auto mt-4 max-w-lg rounded-2xl border border-amber-400/30 bg-amber-500/[0.07] px-4 py-3 text-center text-xs leading-relaxed text-amber-50/95 sm:text-sm">
            <span className="font-semibold text-amber-100">First beta.</span> Match Fit’s initial beta release does not yet ship a
            finished Administrator Portal. The full staff console will be built and switched on when version 1.0 goes live; until then,
            what you see here may be incomplete, experimental, or updated without notice.
          </p>

          <div className="mx-auto mt-10 w-full max-w-md">
            <div className="rounded-3xl border border-white/[0.08] bg-[#0c0f14]/95 p-6 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)] backdrop-blur-xl sm:p-8">
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
                  <label htmlFor="admin-code" className="text-xs font-semibold uppercase tracking-wide text-white/50">
                    Administrator code
                  </label>
                  <input
                    id="admin-code"
                    autoComplete="username"
                    value={adminCode}
                    onChange={(e) => setAdminCode(e.target.value)}
                    className="rounded-xl border border-white/[0.1] bg-[#07080c] px-4 py-3 font-mono text-sm tracking-wide text-white outline-none ring-cyan-400/40 placeholder:text-white/25 focus:border-cyan-400/35 focus:ring-2"
                    placeholder="e.g. jobo0602"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label htmlFor="admin-password" className="text-xs font-semibold uppercase tracking-wide text-white/50">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="admin-password"
                      autoComplete="current-password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-xl border border-white/[0.1] bg-[#07080c] px-4 py-3 pr-24 text-sm text-white outline-none ring-cyan-400/40 placeholder:text-white/25 focus:border-cyan-400/35 focus:ring-2"
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
                    className="h-4 w-4 rounded border-white/20 bg-[#07080c] text-cyan-500 focus:ring-cyan-400/40"
                  />
                  Stay signed in on this device
                </label>

                {TURNSTILE_SITE_KEY ? (
                  <div className="flex justify-center py-1">
                    <TurnstileWidget ref={turnstileRef} siteKey={TURNSTILE_SITE_KEY} />
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={busy}
                  className="group relative isolate mt-1 flex min-h-[3.25rem] w-full items-center justify-center overflow-hidden rounded-xl px-4 text-sm font-black uppercase tracking-[0.08em] text-[#050608] shadow-[0_20px_50px_-18px_rgba(34,211,238,0.35)] transition active:translate-y-px disabled:opacity-50"
                >
                  <span
                    aria-hidden
                    className="absolute inset-0 bg-[linear-gradient(135deg,#67e8f9_0%,#38bdf8_45%,#6366f1_100%)]"
                  />
                  <span className="relative">{busy ? "Signing in…" : "Continue"}</span>
                </button>
              </form>

              <p className="mt-8 text-center text-xs leading-relaxed text-white/40">
                Need access?{" "}
                <Link href="/admin/sign-up" className="text-cyan-300/90 underline-offset-4 hover:underline">
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
