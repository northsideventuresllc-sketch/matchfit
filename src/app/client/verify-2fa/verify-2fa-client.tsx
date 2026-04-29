"use client";

import Link from "next/link";
import { FormEvent, useRef, useState } from "react";
import { TurnstileWidget, type TurnstileWidgetHandle } from "@/components/turnstile-widget";
import { navigateWithFullLoad } from "@/lib/navigate-full-load";

const MOCK_BANNER =
  "Local development: SMS/voice codes are not sent. Look at the terminal where `npm run dev` is running for your 6-digit code.";

function deliveryDescription(method: string): string {
  if (method === "EMAIL") return "We sent a 6-digit code to your email address.";
  if (method === "SMS") return "We sent a 6-digit code by text to your phone number.";
  if (method === "VOICE") return "You will receive a phone call that reads your 6-digit code.";
  return "We sent a 6-digit code using your saved delivery method.";
}

export type Verify2faClientProps = {
  deliveryMethod: string;
  showDevPhoneMockBanner?: boolean;
  completeTwoFactorUrl?: string;
  resendTwoFactorUrl?: string;
  cancelTwoFactorUrl?: string;
  afterVerifyHref?: string;
  /** Safe internal path returned from complete-2FA (e.g. deep link after sign-in). */
  redirectAfterVerify?: string | null;
  cancelReturnHref?: string;
  /** Cloudflare Turnstile site key (same as `NEXT_PUBLIC_TURNSTILE_SITE_KEY`). */
  turnstileSiteKey?: string;
};

const DEFAULT_COMPLETE = "/api/client/login/complete-2fa";
const DEFAULT_RESEND = "/api/client/login/resend-2fa";
const DEFAULT_CANCEL = "/api/client/login/cancel-2fa";
const DEFAULT_AFTER = "/client/dashboard";
const DEFAULT_CANCEL_RETURN = "/client";

export function Verify2faClient(props: Verify2faClientProps) {
  const completeUrl = props.completeTwoFactorUrl ?? DEFAULT_COMPLETE;
  const resendUrl = props.resendTwoFactorUrl ?? DEFAULT_RESEND;
  const cancelUrl = props.cancelTwoFactorUrl ?? DEFAULT_CANCEL;
  const afterVerifyHref = props.afterVerifyHref ?? props.redirectAfterVerify ?? DEFAULT_AFTER;
  const cancelReturnHref = props.cancelReturnHref ?? DEFAULT_CANCEL_RETURN;

  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);
  const [codeInvalidated, setCodeInvalidated] = useState(false);
  const [mockBanner, setMockBanner] = useState(Boolean(props.showDevPhoneMockBanner));
  const turnstileRef = useRef<TurnstileWidgetHandle>(null);
  const tsKey = props.turnstileSiteKey ?? "";

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit code.");
      return;
    }
    if (tsKey) {
      const token = turnstileRef.current?.getToken();
      if (!token) {
        setError("Please wait for the security check to finish, then try again.");
        return;
      }
    }
    setBusy(true);
    try {
      const turnstileToken = tsKey ? turnstileRef.current?.getToken() : undefined;
      const res = await fetch(completeUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          ...(props.redirectAfterVerify ? { next: props.redirectAfterVerify } : {}),
          ...(turnstileToken ? { turnstileToken } : {}),
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        codeInvalidated?: boolean;
        tooManyAttempts?: boolean;
        attemptsRemaining?: number;
        next?: string;
      };
      if (!res.ok) {
        setError(typeof data.error === "string" && data.error.trim() ? data.error : "Verification failed.");
        turnstileRef.current?.reset();
        if (data.codeInvalidated) {
          setCodeInvalidated(true);
        } else if (data.attemptsRemaining !== undefined) {
          setCodeInvalidated(false);
        }
        return;
      }
      const destination = typeof data.next === "string" && data.next.startsWith("/") ? data.next : afterVerifyHref;
      navigateWithFullLoad(destination);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleResend() {
    setError(null);
    setResendBusy(true);
    try {
      const res = await fetch(resendUrl, { method: "POST" });
      const data = (await res.json()) as { error?: string; devPhoneMock?: boolean };
      if (!res.ok) {
        setError(typeof data.error === "string" && data.error.trim() ? data.error : "Could not resend the code.");
        return;
      }
      if (data.devPhoneMock) setMockBanner(true);
      setCodeInvalidated(false);
      setCode("");
      setError(null);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setResendBusy(false);
    }
  }

  async function handleCancel() {
    await fetch(cancelUrl, { method: "POST" });
    navigateWithFullLoad(cancelReturnHref);
  }

  return (
    <main className="relative min-h-dvh overflow-x-hidden bg-[#0B0C0F] text-white antialiased">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(255,211,78,0.14),transparent_55%),radial-gradient(ellipse_90%_60%_at_100%_0%,rgba(255,126,0,0.1),transparent_50%),radial-gradient(ellipse_70%_50%_at_0%_100%,rgba(227,43,43,0.08),transparent_55%)]"
      />
      <div className="relative z-10 mx-auto flex min-h-dvh max-w-lg flex-col px-5 pb-16 pt-10 sm:px-8 sm:pb-20 sm:pt-14">
        <header className="flex items-center justify-between gap-4">
          <Link href="/" className="text-xs font-semibold uppercase tracking-wide text-white/45 hover:text-white/70">
            Home
          </Link>
        </header>

        <div className="mt-12 flex flex-1 flex-col sm:mt-16">
          <h1 className="text-center text-2xl font-black tracking-tight text-white sm:text-3xl">Verify it&apos;s you</h1>
          <p className="mx-auto mt-3 max-w-md text-center text-sm leading-relaxed text-white/55 sm:text-base">
            {deliveryDescription(props.deliveryMethod)} Enter the code below. Your &quot;Stay logged in&quot; choice from
            the previous step still applies after you verify.
          </p>

          {mockBanner ? (
            <p
              className="mx-auto mt-6 max-w-md rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-4 py-3 text-center text-sm leading-relaxed text-emerald-100"
              role="status"
            >
              {MOCK_BANNER}
            </p>
          ) : null}

          <div className="mx-auto mt-10 w-full max-w-md">
            <div className="rounded-3xl border border-white/[0.08] bg-[#12151C]/90 p-6 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.85)] backdrop-blur-xl sm:p-8">
              {error ? (
                <p className="mb-4 rounded-xl border border-[#E32B2B]/35 bg-[#E32B2B]/10 px-4 py-3 text-sm text-[#FFB4B4]" role="alert">
                  {error}
                </p>
              ) : null}

              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                {tsKey ? (
                  <div className="flex justify-center">
                    <TurnstileWidget ref={turnstileRef} siteKey={tsKey} />
                  </div>
                ) : null}
                <div className="flex flex-col gap-2">
                  <label htmlFor="v2-code" className="text-xs font-semibold uppercase tracking-wide text-white/50">
                    6-digit code
                  </label>
                  <input
                    id="v2-code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="000000"
                    disabled={busy}
                    className="rounded-xl border border-white/10 bg-[#0E1016] px-4 py-3 text-[15px] text-white outline-none ring-[#FF7E00]/40 transition placeholder:text-white/25 focus:border-[#FF7E00]/40 focus:ring-2 disabled:opacity-50"
                  />
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="group relative isolate flex min-h-[3.25rem] w-full items-center justify-center overflow-hidden rounded-xl px-4 text-sm font-black uppercase tracking-[0.08em] text-[#0B0C0F] shadow-[0_20px_50px_-18px_rgba(227,43,43,0.45)] transition active:translate-y-px disabled:opacity-50"
                >
                  <span
                    aria-hidden
                    className="absolute inset-0 bg-[linear-gradient(135deg,#FFD34E_0%,#FF7E00_45%,#E32B2B_100%)]"
                  />
                  <span className="relative">{busy ? "Verifying…" : "Verify and continue"}</span>
                </button>
              </form>

              <div className="mt-6 flex flex-col gap-3 border-t border-white/10 pt-6">
                <button
                  type="button"
                  disabled={resendBusy || busy}
                  onClick={() => void handleResend()}
                  className="w-full rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white transition hover:border-white/25 hover:bg-white/[0.07] disabled:opacity-50"
                >
                  {resendBusy ? "Sending…" : codeInvalidated ? "Send new code" : "Resend code"}
                </button>
                <button
                  type="button"
                  disabled={busy || resendBusy}
                  onClick={() => void handleCancel()}
                  className="text-center text-xs font-semibold uppercase tracking-wide text-white/40 transition hover:text-white/65"
                >
                  Cancel and return to sign in
                </button>
              </div>
            </div>

            <p className="mt-8 text-center text-xs text-white/35">
              Codes expire after 10 minutes. In development, SMS/voice codes are printed in the dev server terminal; email
              may use Resend or the console depending on configuration.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
