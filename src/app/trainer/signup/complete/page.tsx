"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { TurnstileField } from "@/components/turnstile-field";
import { trackGoogleAdsConversion } from "@/lib/google-ads";
import { trackMetaConversion } from "@/lib/meta-pixel";
import { useTurnstileGate } from "@/hooks/use-turnstile-gate";
import { navigateWithFullLoad } from "@/lib/navigate-full-load";
import { isTurnstileClientEnabled } from "@/lib/turnstile-config";
import { clearTrainerSignupDraft, readTrainerSignupDraft, type TrainerSupabaseSignupDraft } from "@/lib/trainer-supabase-signup-draft";

export default function TrainerSignupCompletePage() {
  const router = useRouter();
  const turnstile = useTurnstileGate();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  const runServerComplete = useCallback(
    async (draft: TrainerSupabaseSignupDraft, turnstileToken: string | null) => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch("/api/trainer/complete-supabase-signup", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            firstName: draft.firstName,
            lastName: draft.lastName,
            username: draft.username.trim(),
            phone: draft.phone.trim(),
            email: draft.email.trim().toLowerCase(),
            password: draft.password,
            agreedToTerms: draft.agreedToTerms,
            stayLoggedIn: draft.stayLoggedIn,
            serviceZipCode: draft.serviceZipCode?.trim() ?? "",
            ...(draft.betaInviteToken ? { betaInviteToken: draft.betaInviteToken } : {}),
            ...(turnstileToken ? { turnstileToken } : {}),
          }),
        });
        const data = (await res.json()) as { error?: string; next?: string };
        if (!res.ok) {
          setError(data.error ?? "Could not finish creating your account.");
          turnstile.reset();
          setBusy(false);
          return;
        }
        clearTrainerSignupDraft();
        trackGoogleAdsConversion("trainer_signup");
        trackMetaConversion("trainer_signup");
        navigateWithFullLoad(data.next ?? "/trainer/signup/terms");
      } catch {
        setError("Something went wrong. Try again.");
        setBusy(false);
      }
    },
    [turnstile],
  );

  useEffect(() => {
    const draft = readTrainerSignupDraft();
    if (!draft) {
      router.replace("/trainer/signup");
      return;
    }
    setReady(true);
    if (!isTurnstileClientEnabled()) {
      void runServerComplete(draft, null);
    }
  }, [router, runServerComplete]);

  async function finishWithTurnstile() {
    const draft = readTrainerSignupDraft();
    if (!draft) {
      router.replace("/trainer/signup");
      return;
    }
    const tsErr = turnstile.validateBeforeSubmit();
    if (tsErr) {
      setError(tsErr);
      return;
    }
    await runServerComplete(draft, turnstile.getCaptchaToken() ?? null);
  }

  return (
    <main className="relative min-h-dvh overflow-x-hidden bg-[#0B0C0F] text-white antialiased">
      <div className="relative z-10 mx-auto max-w-lg px-5 py-16 sm:px-8">
        <Link href="/trainer/signup" className="mb-10 inline-flex items-center gap-3 opacity-90">
          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg">
            <Image src="/logo.png" alt="Match Fit" fill className="object-contain" sizes="40px" />
          </div>
          <span className="text-sm font-black tracking-tight">
            <span className="text-[#E8EAEF]">Match</span> <span className="text-[#E32B2B]">Fit</span>
          </span>
        </Link>

        <h1 className="text-2xl font-black tracking-tight">Finish creating your trainer account</h1>
        <p className="mt-3 text-sm leading-relaxed text-white/55">
          {turnstile.enabled
            ? "Complete the security check, then create your Match Fit profile."
            : "We are creating your Match Fit profile now."}
        </p>

        {error ? (
          <p
            className="mt-6 rounded-xl border border-[#E32B2B]/35 bg-[#E32B2B]/10 px-4 py-3 text-sm text-[#FFB4B4]"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        {ready && turnstile.enabled ? (
          <div className="mt-8 flex flex-col items-center gap-6">
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
            <button
              type="button"
              disabled={busy || !turnstile.ready}
              onClick={() => void finishWithTurnstile()}
              className="min-h-[3rem] w-full max-w-sm rounded-xl bg-[linear-gradient(135deg,#FFD34E_0%,#FF7E00_45%,#E32B2B_100%)] px-4 text-sm font-black uppercase tracking-[0.08em] text-[#0B0C0F] disabled:opacity-50"
            >
              {busy ? "Working…" : "Create my account"}
            </button>
          </div>
        ) : ready && !turnstile.enabled && busy ? (
          <p className="mt-8 text-sm text-white/50">Creating your account…</p>
        ) : null}

        <p className="mt-10 text-center text-xs text-white/40">
          <Link href="/trainer/signup" className="underline-offset-4 hover:text-white/60 hover:underline">
            Back to sign-up
          </Link>
        </p>
      </div>
    </main>
  );
}
