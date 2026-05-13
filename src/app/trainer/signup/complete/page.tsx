"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { TurnstileWidget, type TurnstileWidgetHandle } from "@/components/turnstile-widget";
import { navigateWithFullLoad } from "@/lib/navigate-full-load";
import { tryCreateMatchFitSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { clearTrainerSignupDraft, readTrainerSignupDraft } from "@/lib/trainer-supabase-signup-draft";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

export default function TrainerSignupCompletePage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const turnstileRef = useRef<TurnstileWidgetHandle>(null);

  useEffect(() => {
    const draft = readTrainerSignupDraft();
    const supabase = tryCreateMatchFitSupabaseBrowserClient();
    if (!draft || !supabase) {
      router.replace("/trainer/signup");
      return;
    }

    let cancelled = false;

    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        if (!cancelled) {
          setError("No active session. Open the link from your verification email again, or start sign-up over.");
        }
        return;
      }
      if (!cancelled) setSessionReady(true);

      if (TURNSTILE_SITE_KEY || cancelled) return;

      setBusy(true);
      try {
        const res = await fetch("/api/trainer/register-with-supabase", {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            firstName: draft.firstName,
            lastName: draft.lastName,
            username: draft.username.trim(),
            phone: draft.phone.trim(),
            email: draft.email.trim().toLowerCase(),
            password: draft.password,
            agreedToTerms: draft.agreedToTerms,
            stayLoggedIn: draft.stayLoggedIn,
          }),
        });
        const data = (await res.json()) as { error?: string; next?: string };
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error ?? "Could not finish creating your account.");
          setBusy(false);
          return;
        }
        clearTrainerSignupDraft();
        navigateWithFullLoad(data.next ?? "/trainer/onboarding");
      } catch {
        if (!cancelled) {
          setError("Something went wrong. Try again.");
          setBusy(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  async function finishWithTurnstile() {
    setError(null);
    const draft = readTrainerSignupDraft();
    const supabase = tryCreateMatchFitSupabaseBrowserClient();
    if (!draft || !supabase) {
      router.replace("/trainer/signup");
      return;
    }
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      setError("Session expired. Open the link from your verification email again.");
      return;
    }
    const turnstileToken = turnstileRef.current?.getToken();
    if (!turnstileToken) {
      setError("Please complete the security check first.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/trainer/register-with-supabase", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          firstName: draft.firstName,
          lastName: draft.lastName,
          username: draft.username.trim(),
          phone: draft.phone.trim(),
          email: draft.email.trim().toLowerCase(),
          password: draft.password,
          agreedToTerms: draft.agreedToTerms,
          stayLoggedIn: draft.stayLoggedIn,
          turnstileToken,
        }),
      });
      const data = (await res.json()) as { error?: string; next?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not finish creating your account.");
        turnstileRef.current?.reset();
        setBusy(false);
        return;
      }
      clearTrainerSignupDraft();
      navigateWithFullLoad(data.next ?? "/trainer/onboarding");
    } catch {
      setError("Something went wrong. Try again.");
      setBusy(false);
    }
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
          Your email is verified.{" "}
          {TURNSTILE_SITE_KEY
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

        {sessionReady && TURNSTILE_SITE_KEY ? (
          <div className="mt-8 flex flex-col items-center gap-6">
            <TurnstileWidget ref={turnstileRef} siteKey={TURNSTILE_SITE_KEY} />
            <button
              type="button"
              disabled={busy}
              onClick={() => void finishWithTurnstile()}
              className="min-h-[3rem] w-full max-w-sm rounded-xl bg-[linear-gradient(135deg,#FFD34E_0%,#FF7E00_45%,#E32B2B_100%)] px-4 text-sm font-black uppercase tracking-[0.08em] text-[#0B0C0F] disabled:opacity-50"
            >
              {busy ? "Working…" : "Create my account"}
            </button>
          </div>
        ) : sessionReady && !TURNSTILE_SITE_KEY && busy ? (
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
