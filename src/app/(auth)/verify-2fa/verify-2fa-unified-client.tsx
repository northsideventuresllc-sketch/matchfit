"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { TurnstileWidget, type TurnstileWidgetHandle } from "@/components/turnstile-widget";
import { resend2FACodeAction, verify2FAAction, type Verify2FAResult } from "@/lib/auth-2fa";

function deliveryDescription(method: string): string {
  if (method === "EMAIL") return "We emailed you a 6-digit code.";
  if (method === "SMS") return "We texted a 6-digit code to your phone.";
  if (method === "VOICE") return "You will receive a call with your 6-digit code.";
  return "Enter the 6-digit code we sent you.";
}

const MOCK_BANNER =
  "Local development: SMS/voice codes are not sent. Check the terminal where `npm run dev` is running for your code.";

function VerifySubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="group relative isolate flex min-h-[3.25rem] w-full items-center justify-center overflow-hidden rounded-xl px-4 text-sm font-black uppercase tracking-[0.08em] text-[#0B0C0F] shadow-[0_20px_50px_-18px_rgba(227,43,43,0.35)] transition active:translate-y-px disabled:opacity-50 dark:shadow-[0_20px_50px_-18px_rgba(255,126,0,0.25)]"
    >
      <span
        aria-hidden
        className="absolute inset-0 bg-[linear-gradient(135deg,#FFD34E_0%,#FF7E00_45%,#E32B2B_100%)]"
      />
      <span className="relative">{pending ? "Verifying…" : "Verify"}</span>
    </button>
  );
}

export type Verify2faUnifiedClientProps = {
  role: "client" | "trainer";
  deliveryMethod: string;
  nextAfterLogin: string | null;
  initialResendCooldownSeconds: number;
  turnstileSiteKey?: string;
  cancelReturnHref: string;
};

export function Verify2faUnifiedClient({
  role,
  deliveryMethod,
  nextAfterLogin,
  initialResendCooldownSeconds,
  turnstileSiteKey,
  cancelReturnHref,
}: Verify2faUnifiedClientProps) {
  const tsKey = turnstileSiteKey ?? "";
  const turnstileRef = useRef<TurnstileWidgetHandle>(null);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const [digits, setDigits] = useState<string[]>(() => Array(6).fill(""));
  const codeJoined = digits.join("");
  const [resendPending, startResendTransition] = useTransition();
  const [resendError, setResendError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(initialResendCooldownSeconds);
  const [mockBanner, setMockBanner] = useState(
    process.env.NODE_ENV === "development" && (deliveryMethod === "SMS" || deliveryMethod === "VOICE"),
  );

  const [state, formAction] = useActionState<Verify2FAResult | null, FormData>(verify2FAAction, null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => (c <= 1 ? 0 : c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  function setDigitAt(i: number, d: string) {
    const next = [...digits];
    next[i] = d.slice(-1);
    setDigits(next);
    if (d && i < 5) {
      inputRefs.current[i + 1]?.focus();
    }
  }

  function onKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      inputRefs.current[i - 1]?.focus();
    }
    if (e.key === "ArrowLeft" && i > 0) inputRefs.current[i - 1]?.focus();
    if (e.key === "ArrowRight" && i < 5) inputRefs.current[i + 1]?.focus();
  }

  function onPaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const raw = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!raw) return;
    const next = [...digits];
    for (let j = 0; j < 6; j++) next[j] = raw[j] ?? "";
    setDigits(next);
    const focusIdx = Math.min(raw.length, 5);
    inputRefs.current[focusIdx]?.focus();
  }

  async function handleResend() {
    setResendError(null);
    startResendTransition(async () => {
      const r = await resend2FACodeAction();
      if (!r.ok) {
        if (r.waitSeconds != null) setCooldown(r.waitSeconds);
        setResendError(r.error);
        return;
      }
      setCooldown(60);
      setDigits(Array(6).fill(""));
      setMockBanner(process.env.NODE_ENV === "development" && (deliveryMethod === "SMS" || deliveryMethod === "VOICE"));
      inputRefs.current[0]?.focus();
    });
  }

  async function handleCancel() {
    const url = role === "client" ? "/api/client/login/cancel-2fa" : "/api/trainer/login/cancel-2fa";
    await fetch(url, { method: "POST" });
    window.location.assign(cancelReturnHref);
  }

  const errorMessage = state?.error ?? null;

  return (
    <main className="relative min-h-dvh overflow-x-hidden bg-[var(--background)] text-[var(--foreground)] antialiased">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(255,211,78,0.12),transparent_55%),radial-gradient(ellipse_90%_60%_at_100%_0%,rgba(255,126,0,0.08),transparent_50%),radial-gradient(ellipse_70%_50%_at_0%_100%,rgba(227,43,43,0.06),transparent_55%)] dark:opacity-100 opacity-80"
      />
      <div className="relative z-10 mx-auto flex min-h-dvh max-w-lg flex-col px-5 pb-16 pt-10 sm:px-8 sm:pb-20 sm:pt-14">
        <header className="flex items-center justify-between gap-4">
          <Link
            href="/"
            className="text-xs font-semibold uppercase tracking-wide text-foreground/50 hover:text-foreground/80"
          >
            Home
          </Link>
        </header>

        <div className="mt-12 flex flex-1 flex-col sm:mt-16">
          <h1 className="text-center text-2xl font-black tracking-tight sm:text-3xl">Verify it&apos;s you</h1>
          <p className="mx-auto mt-3 max-w-md text-center text-sm leading-relaxed text-foreground/60 sm:text-base">
            {deliveryDescription(deliveryMethod)} Enter each digit below. Your &quot;Stay logged in&quot; choice from
            sign-in still applies after you verify.
          </p>

          {mockBanner ? (
            <p
              className="mx-auto mt-6 max-w-md rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-4 py-3 text-center text-sm leading-relaxed text-emerald-900 dark:text-emerald-100"
              role="status"
            >
              {MOCK_BANNER}
            </p>
          ) : null}

          <div className="mx-auto mt-10 w-full max-w-md">
            <div className="rounded-3xl border border-black/10 bg-white/80 p-6 shadow-xl backdrop-blur-xl dark:border-white/[0.08] dark:bg-[#12151C]/90 dark:shadow-[0_30px_80px_-40px_rgba(0,0,0,0.85)] sm:p-8">
              {errorMessage ? (
                <p
                  className="mb-4 rounded-xl border border-red-500/35 bg-red-500/10 px-4 py-3 text-sm text-red-900 dark:text-red-100"
                  role="alert"
                >
                  {errorMessage}
                </p>
              ) : null}
              {resendError ? (
                <p className="mb-4 rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100" role="status">
                  {resendError}
                </p>
              ) : null}

              <form
                action={formAction}
                onSubmit={(e) => {
                  const form = e.currentTarget;
                  const tsInput = form.elements.namedItem("turnstileToken") as HTMLInputElement | null;
                  if (tsInput && tsKey) {
                    tsInput.value = turnstileRef.current?.getToken() ?? "";
                  }
                }}
                className="flex flex-col gap-6"
              >
                <input type="hidden" name="code" value={codeJoined} />
                <input type="hidden" name="next" value={nextAfterLogin ?? ""} readOnly />
                <input type="hidden" name="turnstileToken" defaultValue="" />

                {tsKey ? (
                  <div className="flex justify-center">
                    <TurnstileWidget ref={turnstileRef} siteKey={tsKey} />
                  </div>
                ) : null}

                <div className="flex justify-center gap-2 sm:gap-3" onPaste={onPaste}>
                  {digits.map((d, i) => (
                    <input
                      key={i}
                      ref={(el) => {
                        inputRefs.current[i] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      autoComplete={i === 0 ? "one-time-code" : "off"}
                      maxLength={1}
                      value={d}
                      aria-label={`Digit ${i + 1} of 6`}
                      onChange={(e) => setDigitAt(i, e.target.value.replace(/\D/g, ""))}
                      onKeyDown={(e) => onKeyDown(i, e)}
                      className="h-14 w-11 rounded-xl border border-black/15 bg-[var(--background)] text-center text-2xl font-mono font-semibold tabular-nums text-foreground outline-none ring-[#FF7E00]/30 transition focus:border-[#FF7E00]/50 focus:ring-2 sm:h-16 sm:w-12 dark:border-white/12 dark:bg-[#0E1016]"
                    />
                  ))}
                </div>

                <VerifySubmitButton />
              </form>

              <div className="mt-6 flex flex-col gap-3 border-t border-black/10 pt-6 dark:border-white/10">
                <button
                  type="button"
                  disabled={resendPending || cooldown > 0}
                  onClick={() => void handleResend()}
                  className="w-full rounded-xl border border-black/15 bg-black/[0.03] px-4 py-3 text-sm font-semibold transition hover:bg-black/[0.06] disabled:opacity-50 dark:border-white/15 dark:bg-white/[0.04] dark:hover:bg-white/[0.07]"
                >
                  {resendPending ? "Sending…" : cooldown > 0 ? `Resend code (${cooldown}s)` : "Resend code"}
                </button>
                <button
                  type="button"
                  disabled={resendPending}
                  onClick={() => void handleCancel()}
                  className="text-center text-xs font-semibold uppercase tracking-wide text-foreground/40 transition hover:text-foreground/70"
                >
                  Cancel and return to sign in
                </button>
              </div>
            </div>

            <p className="mt-8 text-center text-xs text-foreground/45">
              <Link href="/admin/login" className="underline-offset-4 transition hover:underline">
                Administrator Log In
              </Link>
              <span className="mx-2 text-foreground/25">·</span>
              Codes expire after 10 minutes.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
