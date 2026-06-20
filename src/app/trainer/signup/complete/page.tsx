"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { TurnstileField } from "@/components/turnstile-field";
import { useTurnstileGate } from "@/hooks/use-turnstile-gate";
import { navigateWithFullLoad } from "@/lib/navigate-full-load";
import { isTurnstileClientEnabled } from "@/lib/turnstile-config";
import {
  readTrainerSignupDraft,
  writeTrainerSignupDraft,
  type TrainerSupabaseSignupDraft,
} from "@/lib/trainer-supabase-signup-draft";

type RecoveredDraftFields = {
  firstName?: string;
  lastName?: string;
  username?: string;
  phone?: string;
  serviceZipCode?: string;
  betaInviteToken?: string;
  agreedToTerms?: boolean;
  stayLoggedIn?: boolean;
};

export default function TrainerSignupCompletePage() {
  const router = useRouter();
  const turnstile = useTurnstileGate();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<TrainerSupabaseSignupDraft | null>(() => readTrainerSignupDraft());
  const [checkingServerDraft, setCheckingServerDraft] = useState(false);
  const [recovered, setRecovered] = useState<{ email: string; fields: RecoveredDraftFields } | null>(null);
  const [recoverPassword, setRecoverPassword] = useState("");

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
        // Keep the draft in sessionStorage — the Fitness Pro agreement step still needs
        // it to create the Trainer row, and clears it itself once that succeeds.
        navigateWithFullLoad(data.next ?? "/trainer/signup/terms");
      } catch {
        setError("Something went wrong. Try again.");
        setBusy(false);
      }
    },
    [turnstile],
  );

  useEffect(() => {
    if (draft) {
      if (!isTurnstileClientEnabled()) {
        void Promise.resolve().then(() => runServerComplete(draft, null));
      }
      return;
    }

    // The sessionStorage draft only survives in the original tab. If the trainer
    // confirmed their email in a new tab/device, recover what the server saved
    // when the verification email was sent (everything except the password).
    let cancelled = false;
    setCheckingServerDraft(true);
    void fetch("/api/trainer/onboarding/draft", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { data?: RecoveredDraftFields | null; email?: string | null } | null) => {
        if (cancelled) return;
        if (body?.data && body.email) {
          setRecovered({ email: body.email, fields: body.data });
        } else {
          router.replace("/trainer/signup");
        }
      })
      .catch(() => {
        if (!cancelled) router.replace("/trainer/signup");
      })
      .finally(() => {
        if (!cancelled) setCheckingServerDraft(false);
      });
    return () => {
      cancelled = true;
    };
  }, [draft, router, runServerComplete]);

  async function submitRecovery(turnstileToken: string | null) {
    if (!recovered) return;
    if (!recoverPassword) {
      setError("Enter your password to continue.");
      return;
    }
    const rebuilt: TrainerSupabaseSignupDraft = {
      firstName: recovered.fields.firstName ?? "",
      lastName: recovered.fields.lastName ?? "",
      username: recovered.fields.username ?? "",
      phone: recovered.fields.phone ?? "",
      email: recovered.email,
      password: recoverPassword,
      agreedToTerms: recovered.fields.agreedToTerms ?? true,
      stayLoggedIn: recovered.fields.stayLoggedIn ?? true,
      serviceZipCode: recovered.fields.serviceZipCode,
      betaInviteToken: recovered.fields.betaInviteToken,
    };
    writeTrainerSignupDraft(rebuilt);
    await runServerComplete(rebuilt, turnstileToken);
  }

  async function finishWithTurnstile() {
    if (recovered) {
      const tsErr = turnstile.validateBeforeSubmit();
      if (tsErr) {
        setError(tsErr);
        return;
      }
      await submitRecovery(turnstile.getCaptchaToken() ?? null);
      return;
    }
    const existing = draft ?? readTrainerSignupDraft();
    if (!existing) {
      router.replace("/trainer/signup");
      return;
    }
    const tsErr = turnstile.validateBeforeSubmit();
    if (tsErr) {
      setError(tsErr);
      return;
    }
    await runServerComplete(existing, turnstile.getCaptchaToken() ?? null);
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

        <h1 className="text-2xl font-black tracking-tight">Continue to Fitness Pro agreement</h1>
        <p className="mt-3 text-sm leading-relaxed text-white/55">
          {turnstile.enabled
            ? "Complete the security check, then continue to the Fitness Pro agreement. Your Match Fit account is created when you accept."
            : "We are verifying your email confirmation before the Fitness Pro agreement step."}
        </p>

        {error ? (
          <p
            className="mt-6 rounded-xl border border-[#E32B2B]/35 bg-[#E32B2B]/10 px-4 py-3 text-sm text-[#FFB4B4]"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        {checkingServerDraft ? (
          <p className="mt-8 text-sm text-white/50">Looking up your sign-up details…</p>
        ) : recovered ? (
          <div className="mt-8 flex flex-col items-center gap-4">
            <p className="text-center text-sm text-white/55">
              We found your sign-up for <span className="text-white">{recovered.email}</span>. Enter your
              password again to continue — we don&apos;t store it between steps.
            </p>
            <input
              type="password"
              autoComplete="current-password"
              value={recoverPassword}
              onChange={(e) => setRecoverPassword(e.target.value)}
              placeholder="Password"
              className="w-full max-w-sm rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-[#FF7E00]/60 focus:outline-none"
            />
            {turnstile.enabled ? (
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
            ) : null}
            <button
              type="button"
              disabled={busy || !recoverPassword || (turnstile.enabled && !turnstile.ready)}
              onClick={() => void finishWithTurnstile()}
              className="min-h-[3rem] w-full max-w-sm rounded-xl bg-[linear-gradient(135deg,#FFD34E_0%,#FF7E00_45%,#E32B2B_100%)] px-4 text-sm font-black uppercase tracking-[0.08em] text-[#0B0C0F] disabled:opacity-50"
            >
              {busy ? "Working…" : "Continue to agreement"}
            </button>
          </div>
        ) : draft && turnstile.enabled ? (
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
              {busy ? "Working…" : "Continue to agreement"}
            </button>
          </div>
        ) : draft && !turnstile.enabled && busy ? (
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
