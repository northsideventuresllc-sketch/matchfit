"use client";

import Image from "next/image";
import Link from "next/link";
import { TurnstileField } from "@/components/turnstile-field";
import { useTurnstileGate } from "@/hooks/use-turnstile-gate";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { navigateWithFullLoad } from "@/lib/navigate-full-load";
import { trackGoogleAdsConversion } from "@/lib/google-ads";
import { trackMetaConversion } from "@/lib/meta-pixel";
import { TRAINER_SIGNUP_AGREEMENT_DOCUMENT } from "@/app/trainer/onboarding/trainer-agreement-bullets";
import {
  clearTrainerSignupDraft,
  readTrainerSignupDraft,
  type TrainerSupabaseSignupDraft,
} from "@/lib/trainer-supabase-signup-draft";
import {
  bindFormFieldFocus,
  trackFormSubmitAttempt,
  trackFormSubmitError,
  trackFormSubmitSuccess,
} from "@/lib/site-analytics-form";

const inputClass =
  "w-full rounded-xl border border-white/10 bg-[#0E1016] px-4 py-3 text-[15px] text-white outline-none ring-[#FF7E00]/40 transition placeholder:text-white/25 focus:border-[#FF7E00]/40 focus:ring-2";

const FORM_CTX = { path: "/trainer/signup/terms", formId: "trainer_signup_terms" };

export default function TrainerSignupTermsClient() {
  const router = useRouter();
  const turnstile = useTurnstileGate();
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft] = useState<TrainerSupabaseSignupDraft | null>(() =>
    typeof window === "undefined" ? null : readTrainerSignupDraft(),
  );
  const [ready] = useState(true);

  useEffect(() => {
    if (!ready) return;
    if (!draft) {
      void fetch("/api/trainer/signup/terms-status", { credentials: "include" })
        .then(async (res) => {
          if (!res.ok) router.replace("/trainer/signup");
        })
        .catch(() => router.replace("/trainer/signup"));
    }
  }, [ready, draft, router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!accepted) {
      setError("Please confirm that you agree to the Fitness Pro Agreement and Terms of Service.");
      return;
    }
    if (draft) {
      const tsErr = turnstile.validateBeforeSubmit();
      if (tsErr) {
        setError(tsErr);
        return;
      }
    }
    trackFormSubmitAttempt(FORM_CTX);
    setBusy(true);
    try {
      const payload: Record<string, unknown> = { acceptedTrainerAgreement: true };
      if (draft) {
        payload.signup = {
          firstName: draft.firstName,
          lastName: draft.lastName,
          username: draft.username.trim(),
          phone: draft.phone.trim(),
          email: draft.email.trim().toLowerCase(),
          password: draft.password,
          stayLoggedIn: draft.stayLoggedIn,
          serviceZipCode: draft.serviceZipCode?.trim() ?? "",
          ...(draft.betaInviteToken ? { betaInviteToken: draft.betaInviteToken } : {}),
        };
        const token = turnstile.getCaptchaToken();
        if (token) payload.turnstileToken = token;
      }

      const res = await fetch("/api/trainer/signup/terms", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { error?: string; next?: string; code?: string };
      if (!res.ok) {
        trackFormSubmitError(FORM_CTX, data.code ?? "terms_save_failed");
        setError(data.error ?? "Could not save your agreement.");
        turnstile.reset();
        setBusy(false);
        return;
      }
      clearTrainerSignupDraft();
      trackFormSubmitSuccess(FORM_CTX);
      trackGoogleAdsConversion("trainer_signup");
      trackMetaConversion("trainer_signup");
      navigateWithFullLoad(data.next ?? "/trainer/dashboard");
    } catch {
      trackFormSubmitError(FORM_CTX, "network_error");
      setError("Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  if (!ready) {
    return <main className="min-h-dvh bg-[#0B0C0F]" aria-hidden />;
  }

  return (
    <main className="relative min-h-dvh overflow-x-hidden bg-[#0B0C0F] px-5 py-10 text-white sm:px-8">
      <div className="mx-auto max-w-2xl">
        <Link href="/trainer/signup" className="inline-flex items-center gap-3">
          <div className="relative h-10 w-10 overflow-hidden rounded-lg">
            <Image src="/logo.png" alt="Match Fit" fill className="object-contain" sizes="40px" />
          </div>
          <span className="text-sm font-bold text-white/70">Back to account details</span>
        </Link>

        <h1 className="mt-8 text-2xl font-black uppercase tracking-tight sm:text-3xl">Fitness Pro agreement</h1>
        <p className="mt-2 text-sm text-white/55">
          Read the summary below, then open the full Terms of Service and Privacy Policy. When you agree, your Match Fit
          Fitness Pro account is created automatically. You have 7 days from sign-up to begin onboarding—pay your background
          check through our portal and start certification and screening. You cannot sell services until every requirement
          is completed.
        </p>

        <article className="mt-6 max-h-[min(50vh,28rem)] overflow-y-auto rounded-2xl border border-white/[0.08] bg-[#12151C]/90 p-5 text-sm leading-relaxed text-white/70">
          {TRAINER_SIGNUP_AGREEMENT_DOCUMENT.split("\n\n").map((para, i) => (
            <p key={i} className={i > 0 ? "mt-4" : undefined}>
              {para}
            </p>
          ))}
        </article>

        <p className="mt-4 text-xs text-white/45">
          <Link href="/terms" target="_blank" rel="noopener noreferrer" className="text-[#FF7E00] hover:underline">
            Terms of Service
          </Link>
          {" · "}
          <Link href="/privacy" target="_blank" rel="noopener noreferrer" className="text-[#FF7E00] hover:underline">
            Privacy Policy
          </Link>
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 ${inputClass}`}>
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              onFocus={bindFormFieldFocus(FORM_CTX, "acceptedTrainerAgreement")}
              className="mt-1 h-4 w-4 shrink-0 accent-[#FF7E00]"
            />
            <span className="text-sm leading-relaxed text-white/80">
              I have read and agree to the Fitness Pro Agreement, Terms of Service, and Privacy Policy.
            </span>
          </label>
          {draft ? (
            <TurnstileField
              enabled={turnstile.enabled}
              widgetRef={turnstile.ref}
              siteKey={turnstile.siteKey}
              onReady={turnstile.onTurnstileReady}
              onError={turnstile.onTurnstileError}
              onExpire={turnstile.onTurnstileExpire}
              widgetError={turnstile.widgetError}
              ready={turnstile.ready}
              className="flex justify-center"
            />
          ) : null}
          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
          <button
            type="submit"
            disabled={busy || (Boolean(draft) && turnstile.enabled && !turnstile.ready)}
            className="flex min-h-[3rem] w-full items-center justify-center rounded-xl bg-[linear-gradient(135deg,#FFD34E_0%,#FF7E00_45%,#E32B2B_100%)] text-sm font-black uppercase tracking-[0.08em] text-[#0B0C0F] disabled:opacity-60"
          >
            {busy ? "Creating your account…" : "Agree and create my account"}
          </button>
        </form>
      </div>
    </main>
  );
}
