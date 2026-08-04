"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { TurnstileField } from "@/components/turnstile-field";
import { trackGoogleAdsConversion } from "@/lib/google-ads";
import { trackMetaConversion } from "@/lib/meta-pixel";
import { navigateWithFullLoad } from "@/lib/navigate-full-load";
import { getSupabaseEmailCallbackUrl, isSupabaseConfigured } from "@/lib/supabase/email-callback-url";
import { buildSupabaseSignUpOptions } from "@/lib/supabase/sign-up-options";
import { tryCreateMatchFitSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { writeTrainerSignupDraft } from "@/lib/trainer-supabase-signup-draft";
import { describePasswordPolicyViolations } from "@/lib/validations/client-register";
import { BetaCapFullSignupNotice } from "@/components/beta-cap-full-signup-notice";
import { useBetaLaunchStatus } from "@/hooks/use-beta-launch-status";
import { useMetaSignupFunnelStep } from "@/hooks/use-meta-signup-funnel-step";
import { useTurnstileGate } from "@/hooks/use-turnstile-gate";
import { trackMetaLead } from "@/lib/meta-pixel-funnel";
import { TRAINER_SIGNUP_FLOW_OVERVIEW } from "@/lib/trainer-signup-payment-messaging";
import { useSignupProgressReport } from "@/lib/use-signup-progress-report";
import { FormEvent, useEffect, useMemo, useState } from "react";

const inputClass =
  "w-full rounded-xl border border-white/10 bg-[#0E1016] px-4 py-3 text-[15px] text-white outline-none ring-[#FF7E00]/40 transition placeholder:text-white/25 focus:border-[#FF7E00]/40 focus:ring-2";

const labelClass = "text-xs font-semibold uppercase tracking-wide text-white/50";

function countPhoneDigits(phone: string): number {
  return phone.replace(/\D/g, "").length;
}

// Worldwide (JB decision 2026-07-31): any ZIP/postal code format, not just US 5-digit.
// Empty is valid too — a virtual-only trainer may have no service ZIP at all.
function isValidSignupServiceZip(zip: string): boolean {
  const t = zip.trim();
  if (!t) return true;
  return /^[a-zA-Z0-9][a-zA-Z0-9\s-]{1,10}$/.test(t);
}

function simpleEmailValid(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function formatTrainerSignupFinishError(error: string, code?: string): string {
  if (code === "SCHEMA_OUT_OF_DATE") {
    return "Sign-up is temporarily unavailable while we finish a database update. Try again in a few minutes.";
  }
  if (code === "EMAIL_TAKEN") {
    return "That email already has a Match Fit Fitness Pro account. Try signing in instead.";
  }
  if (code === "USERNAME_TAKEN") {
    return "That username is already taken. Choose a different username above, then try Finish again.";
  }
  if (code === "INVALID_SERVICE_ZIP") {
    return "Enter a valid ZIP / postal code in the form above, then try Finish again.";
  }
  if (code === "EMAIL_NOT_CONFIRMED") {
    return "Your email is not confirmed yet. Check your inbox, or tap Resend verification email.";
  }
  if (code === "SUPABASE_AUTH_FAILED" || code === "SUPABASE_PASSWORD_SYNC_FAILED") {
    return "We could not verify your password. Re-enter the password from the form above, then try Finish again.";
  }
  if (error.toLowerCase().includes("captcha")) {
    return "Complete the security check below, then tap Finish sign-up with password again.";
  }
  return error;
}

export default function TrainerSignUpClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const betaInviteFromUrl = searchParams.get("betaInvite")?.trim() || "";
  const [serviceZipCode, setServiceZipCode] = useState("");
  const { status: betaStatus, loading: betaStatusLoading } = useBetaLaunchStatus();
  const trainerCapFull =
    betaStatus?.gatesEnabled === true &&
    betaStatus.trainerWaitlistOpen === true &&
    !betaInviteFromUrl;
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [stayLoggedIn, setStayLoggedIn] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [betaInviteReserved, setBetaInviteReserved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [verificationEmailSent, setVerificationEmailSent] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);
  const [resendNotice, setResendNotice] = useState<string | null>(null);
  const turnstile = useTurnstileGate();
  const reportSignupProgress = useSignupProgressReport("trainer");

  useEffect(() => {
    reportSignupProgress(
      {
        firstName: Boolean(firstName.trim()),
        lastName: Boolean(lastName.trim()),
        username: Boolean(username.trim()),
        phone: Boolean(phone.trim()),
        email: Boolean(email.trim()),
        password: Boolean(password),
        serviceZipCode: Boolean(serviceZipCode.trim()),
        agreedToTerms: false,
      },
      { email, username },
    );
  }, [firstName, lastName, username, phone, email, password, serviceZipCode, reportSignupProgress]);

  const wizardFunnelStep = useMemo(
    () =>
      verificationEmailSent
        ? {
            funnel: "trainer" as const,
            step_id: "sign_up_email_sent",
            step_name: "Verification email sent",
            step_index: 2,
          }
        : {
            funnel: "trainer" as const,
            step_id: "sign_up_form_active",
            step_name: "Sign-up form",
            step_index: 1,
          },
    [verificationEmailSent],
  );
  useMetaSignupFunnelStep(wizardFunnelStep);

  const resetTurnstile = turnstile.reset;

  useEffect(() => {
    if (!verificationEmailSent) return;
    resetTurnstile();
  }, [verificationEmailSent, resetTurnstile]);

  useEffect(() => {
    if (!betaInviteFromUrl) return;
    let cancelled = false;
    void fetch(`/api/public/beta-invite?betaInvite=${encodeURIComponent(betaInviteFromUrl)}`)
      .then((r) => r.json())
      .then((d: { valid?: boolean; firstName?: string; email?: string; desiredUsername?: string }) => {
        if (cancelled || !d.valid) return;
        if (d.firstName?.trim()) setFirstName(d.firstName.trim());
        if (d.email?.trim()) setEmail(d.email.trim().toLowerCase());
        if (d.desiredUsername?.trim()) setUsername(d.desiredUsername.trim());
        setBetaInviteReserved(d.desiredUsername?.trim() ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [betaInviteFromUrl]);

  async function deliverTrainerVerificationEmail(args: {
    emailNorm: string;
    password: string;
    firstName: string;
    turnstileToken: string | null;
    draft?: {
      lastName: string;
      username: string;
      phone: string;
      serviceZipCode: string;
      betaInviteToken?: string;
      agreedToTerms: boolean;
      stayLoggedIn: boolean;
    };
  }): Promise<{ ok: true } | { ok: false; error: string; code?: string; retryAfterSeconds?: number }> {
    const res = await fetch("/api/public/resend-signup-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: args.emailNorm,
        password: args.password,
        role: "trainer",
        firstName: args.firstName,
        ...(args.turnstileToken ? { turnstileToken: args.turnstileToken } : {}),
        ...(args.draft ? { draft: args.draft } : {}),
      }),
    });
    const data = (await res.json()) as {
      error?: string;
      code?: string;
      retryAfterSeconds?: number | null;
    };
    if (!res.ok) {
      return {
        ok: false,
        error: data.error ?? "Could not send the verification email.",
        code: data.code,
        retryAfterSeconds: data.retryAfterSeconds ?? undefined,
      };
    }
    return { ok: true };
  }

  async function finishTrainerSignupOnServer(registerCore: {
    firstName: string;
    lastName: string;
    username: string;
    phone: string;
    email: string;
    password: string;
    stayLoggedIn: boolean;
    serviceZipCode: string;
    betaInviteToken?: string;
    turnstileToken?: string | null;
  }): Promise<{ ok: true } | { ok: false; error: string; code?: string }> {
    const res = await fetch("/api/trainer/complete-supabase-signup", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: registerCore.firstName,
        lastName: registerCore.lastName,
        username: registerCore.username,
        phone: registerCore.phone,
        email: registerCore.email,
        password: registerCore.password,
        stayLoggedIn: registerCore.stayLoggedIn,
        serviceZipCode: registerCore.serviceZipCode,
        agreedToTerms: true,
        ...(registerCore.betaInviteToken ? { betaInviteToken: registerCore.betaInviteToken } : {}),
        ...(registerCore.turnstileToken ? { turnstileToken: registerCore.turnstileToken } : {}),
      }),
    });
    const data = (await res.json()) as { error?: string; next?: string; code?: string };
    if (!res.ok) {
      return {
        ok: false,
        error: data.error ?? "Could not finish creating your account.",
        code: data.code,
      };
    }
    navigateWithFullLoad(data.next ?? "/trainer/signup/terms");
    return { ok: true };
  }

  async function handleContinueWithPassword() {
    setError(null);
    setResendNotice(null);
    const emailNorm = email.trim().toLowerCase();
    if (!firstName.trim() || !lastName.trim()) {
      setError("Enter your first and last name.");
      return;
    }
    const u = username.trim();
    if (!u || u.length < 3) {
      setError("Username must be at least 3 characters.");
      return;
    }
    if (!phone.trim() || countPhoneDigits(phone) < 10) {
      setError("Enter a valid phone number.");
      return;
    }
    if (!emailNorm || !password) {
      setError("Enter your email and password, then try again.");
      return;
    }
    if (!isValidSignupServiceZip(serviceZipCode)) {
      setError("Enter a valid ZIP / postal code.");
      return;
    }
    const tsErr = turnstile.validateBeforeSubmit();
    if (tsErr) {
      setError(tsErr);
      return;
    }
    setBusy(true);
    try {
      const result = await finishTrainerSignupOnServer({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        username: u,
        phone: phone.trim(),
        email: emailNorm,
        password,
        stayLoggedIn,
        serviceZipCode: serviceZipCode.trim(),
        ...(betaInviteFromUrl ? { betaInviteToken: betaInviteFromUrl } : {}),
        turnstileToken: turnstile.getCaptchaToken() ?? null,
      });
      if (!result.ok) {
        setError(formatTrainerSignupFinishError(result.error, result.code));
        turnstile.reset();
        setBusy(false);
      }
    } catch {
      setError("Something went wrong. Try again.");
      turnstile.reset();
      setBusy(false);
    }
  }

  async function handleResendVerificationEmail() {
    setError(null);
    setResendNotice(null);
    const emailNorm = email.trim().toLowerCase();
    if (!emailNorm || !simpleEmailValid(emailNorm)) {
      setError("Enter a valid email address.");
      return;
    }
    const tsErr = turnstile.validateBeforeSubmit();
    if (tsErr) {
      setError(tsErr);
      return;
    }
    setResendBusy(true);
    try {
      const delivery = await deliverTrainerVerificationEmail({
        emailNorm,
        password,
        firstName: firstName.trim(),
        turnstileToken: turnstile.getCaptchaToken() ?? null,
        draft: {
          lastName: lastName.trim(),
          username: username.trim(),
          phone: phone.trim(),
          serviceZipCode: serviceZipCode.trim(),
          ...(betaInviteFromUrl ? { betaInviteToken: betaInviteFromUrl } : {}),
          agreedToTerms: true,
          stayLoggedIn,
        },
      });
      if (!delivery.ok) {
        setError(delivery.error);
        turnstile.reset();
        return;
      }
      setResendNotice("Verification email sent again. Check your inbox and spam folder.");
    } catch {
      setError("Something went wrong. Try again.");
      turnstile.reset();
    } finally {
      setResendBusy(false);
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!firstName.trim()) {
      setError("First name is required.");
      return;
    }
    if (!lastName.trim()) {
      setError("Last name is required.");
      return;
    }
    const u = username.trim();
    if (!u || u.length < 3) {
      setError("Username must be at least 3 characters.");
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(u)) {
      setError("Username may only use letters, numbers, and underscores.");
      return;
    }
    if (!phone.trim() || countPhoneDigits(phone) < 10) {
      setError("Enter a valid phone number with at least 10 digits.");
      return;
    }
    if (!email.trim() || !simpleEmailValid(email)) {
      setError("Enter a valid email address.");
      return;
    }
    const pwMsg = describePasswordPolicyViolations(password);
    if (pwMsg) {
      setError(pwMsg);
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!isValidSignupServiceZip(serviceZipCode)) {
      setError("Enter a valid ZIP / postal code.");
      return;
    }
    const tsErr = turnstile.validateBeforeSubmit();
    if (tsErr) {
      setError(tsErr);
      return;
    }

    setBusy(true);
    try {
      const turnstileToken = turnstile.getCaptchaToken() ?? null;
      const emailNorm = email.trim().toLowerCase();
      const registerCore = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        username: u,
        phone: phone.trim(),
        email: emailNorm,
        password,
        stayLoggedIn,
        serviceZipCode: serviceZipCode.trim(),
        ...(betaInviteFromUrl ? { betaInviteToken: betaInviteFromUrl } : {}),
        ...(turnstileToken ? { turnstileToken } : {}),
      };

      if (isSupabaseConfigured()) {
        writeTrainerSignupDraft({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          username: u,
          phone: phone.trim(),
          email: emailNorm,
          password,
          agreedToTerms: true,
          stayLoggedIn,
          serviceZipCode: serviceZipCode.trim(),
          ...(betaInviteFromUrl ? { betaInviteToken: betaInviteFromUrl } : {}),
        });

        const delivery = await deliverTrainerVerificationEmail({
          emailNorm,
          password,
          firstName: firstName.trim(),
          turnstileToken: turnstileToken ?? null,
          draft: {
            lastName: lastName.trim(),
            username: u,
            phone: phone.trim(),
            serviceZipCode: serviceZipCode.trim(),
            ...(betaInviteFromUrl ? { betaInviteToken: betaInviteFromUrl } : {}),
            agreedToTerms: true,
            stayLoggedIn,
          },
        });

        if (
          !delivery.ok &&
          (delivery.code === "SUPABASE_ADMIN_NOT_CONFIGURED" || delivery.code === "RESEND_NOT_CONFIGURED")
        ) {
          const supabase = tryCreateMatchFitSupabaseBrowserClient();
          if (!supabase) {
            setError("Supabase client could not be created. Check environment variables.");
            setBusy(false);
            return;
          }

          const { data: signData, error: signErr } = await supabase.auth.signUp({
            email: emailNorm,
            password,
            options: buildSupabaseSignUpOptions({
              emailRedirectTo: getSupabaseEmailCallbackUrl(),
              turnstileToken,
              data: {
                match_fit_role: "trainer",
                pending_match_fit_profile: true,
              },
            }),
          });

          if (signErr) {
            setError(signErr.message || "Could not start email verification.");
            turnstile.reset();
            setBusy(false);
            return;
          }

          if (signData.session) {
            const res = await fetch("/api/trainer/register", {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(registerCore),
            });
            const data = (await res.json()) as { error?: string; next?: string; code?: string };
            if (!res.ok) {
              setErrorCode(data.code ?? null);
              setError(
                data.code === "BETA_TRAINER_CAP"
                  ? (data.error ?? "Fitness Pro slots are full for this beta.")
                  : (data.error ?? "Could not create your account."),
              );
              turnstile.reset();
              setBusy(false);
              return;
            }
            trackGoogleAdsConversion("trainer_signup");
            trackMetaConversion("trainer_signup");
            writeTrainerSignupDraft({
              firstName: firstName.trim(),
              lastName: lastName.trim(),
              username: u,
              phone: phone.trim(),
              email: emailNorm,
              password,
              agreedToTerms: true,
              stayLoggedIn,
              serviceZipCode: serviceZipCode.trim(),
              ...(betaInviteFromUrl ? { betaInviteToken: betaInviteFromUrl } : {}),
            });
            navigateWithFullLoad(data.next ?? "/trainer/signup/terms");
            return;
          }

          trackMetaLead("trainer");
          setVerificationEmailSent(true);
          setResendNotice(null);
          setBusy(false);
          return;
        }

        if (!delivery.ok) {
          if (delivery.code === "EMAIL_ALREADY_CONFIRMED") {
            const finished = await finishTrainerSignupOnServer({
              ...registerCore,
              turnstileToken,
            });
            if (!finished.ok) {
              setError(formatTrainerSignupFinishError(finished.error, finished.code));
              setResendNotice("Your email is verified. Use Finish sign-up with password below.");
              setVerificationEmailSent(true);
              turnstile.reset();
            }
            setBusy(false);
            return;
          }
          setError(delivery.error ?? "We could not send the verification email.");
          turnstile.reset();
          setVerificationEmailSent(true);
          setBusy(false);
          return;
        }

        trackMetaLead("trainer");
        setVerificationEmailSent(true);
        setResendNotice(null);
        setBusy(false);
        return;
      }

      const res = await fetch("/api/trainer/register", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(registerCore),
      });
      const data = (await res.json()) as { error?: string; next?: string; code?: string };
      if (!res.ok) {
        setErrorCode(data.code ?? null);
        setError(
          data.code === "BETA_TRAINER_CAP"
            ? (data.error ?? "Fitness Pro slots are full for this beta.")
            : (data.error ?? "Could not create your account."),
        );
        turnstile.reset();
        return;
      }
      trackGoogleAdsConversion("trainer_signup");
      trackMetaConversion("trainer_signup");
      writeTrainerSignupDraft({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        username: u,
        phone: phone.trim(),
        email: emailNorm,
        password,
        agreedToTerms: true,
        stayLoggedIn,
        serviceZipCode: serviceZipCode.trim(),
        ...(betaInviteFromUrl ? { betaInviteToken: betaInviteFromUrl } : {}),
      });
      navigateWithFullLoad(data.next ?? "/trainer/signup/terms");
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
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(255,211,78,0.14),transparent_55%),radial-gradient(ellipse_90%_60%_at_100%_0%,rgba(255,126,0,0.1),transparent_50%),radial-gradient(ellipse_70%_50%_at_0%_100%,rgba(227,43,43,0.06),transparent_55%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(45,52,64,0.3)_0%,transparent_35%,transparent_70%,rgba(11,12,15,0.9)_100%)]"
      />

      <div className="relative z-10 mx-auto max-w-xl px-5 pb-20 pt-10 sm:px-8 sm:pt-14">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/trainer/dashboard/login" className="flex items-center gap-3 opacity-90 transition hover:opacity-100">
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl sm:h-14 sm:w-14">
              <Image src="/logo.png" alt="Match Fit" fill className="object-contain" sizes="56px" />
            </div>
            <div className="leading-none">
              <p className="text-sm font-black tracking-tight sm:text-base">
                <span className="text-[#E8EAEF]">Match</span> <span className="text-[#E32B2B]">Fit</span>
              </p>
            </div>
          </Link>
          <Link
            href="/trainer/dashboard/login"
            className="text-xs font-semibold uppercase tracking-wide text-white/50 transition hover:text-white/75"
          >
            Back to Sign-In
          </Link>
        </header>

        <h1 className="mt-10 text-2xl font-black tracking-tight sm:mt-12 sm:text-3xl">Create Your Fitness Pro Account</h1>
        <p className="mt-3 text-sm leading-relaxed text-white/60 sm:text-base">{TRAINER_SIGNUP_FLOW_OVERVIEW}</p>

        {betaInviteReserved ? (
          <p className="mt-4 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100/95">
            Beta invite active — sign up as <span className="font-semibold text-white">@{betaInviteReserved}</span> with
            the invited email before your reserved slot expires.
          </p>
        ) : null}

        <div className="mt-8 rounded-3xl border border-white/[0.08] bg-[#12151C]/90 p-6 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.85)] backdrop-blur-xl sm:p-8">
          {betaStatusLoading ? (
            <p className="text-sm text-white/50">Checking availability…</p>
          ) : trainerCapFull ? (
            <BetaCapFullSignupNotice
              role="trainer"
              waitlistHref="/waitlist/trainer"
              cap={betaStatus?.trainerCap ?? null}
              count={betaStatus?.trainerCount ?? null}
              slotsUsed={betaStatus?.trainerSlotsUsed ?? null}
            />
          ) : (
            <>
          {error ? (
            <p
              className="mb-5 rounded-xl border border-[#E32B2B]/35 bg-[#E32B2B]/10 px-4 py-3 text-sm text-[#FFB4B4]"
              role="alert"
            >
              {error}
              {errorCode === "BETA_TRAINER_CAP" ? (
                <>
                  {" "}
                  <Link href="/waitlist/trainer" className="font-semibold text-[#FF7E00] underline-offset-2 hover:underline">
                    Join the Fitness Pro waitlist
                  </Link>
                </>
              ) : null}
            </p>
          ) : null}

          {verificationEmailSent ? (
            <div
              className="mb-6 rounded-2xl border border-emerald-500/35 bg-emerald-500/10 px-5 py-5"
              role="status"
              aria-live="polite"
            >
              <p className="text-base font-black tracking-tight text-emerald-50">Verification email sent</p>
              <p className="mt-3 rounded-xl border border-[#FFD34E]/35 bg-[#FFD34E]/10 px-4 py-3 text-sm leading-relaxed text-[#FFF4D0]">
                <span className="font-semibold text-white">Already verified?</span> Skip waiting for email and tap{" "}
                <span className="font-semibold">Finish sign-up with password</span> below.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-emerald-100/85">
                We sent a message to <span className="font-semibold text-white">{email.trim()}</span>. Open it and tap
                <span className="font-semibold"> Confirm your email</span>. You will return here to finish security check,
                then you will continue to the Fitness Pro agreement, account type, documents, and payment steps.
              </p>
              <p className="mt-3 text-xs leading-relaxed text-emerald-100/60">
                Did not get it? Check spam, then use Resend below. The link expires after a while.
              </p>
              {resendNotice ? (
                <p className="mt-3 text-xs font-semibold text-emerald-100/90" role="status">
                  {resendNotice}
                </p>
              ) : null}
              <button
                type="button"
                disabled={resendBusy || busy || (turnstile.enabled && !turnstile.ready)}
                onClick={() => void handleResendVerificationEmail()}
                className="mt-5 min-h-[2.75rem] w-full rounded-xl border border-[#FF7E00]/45 bg-[#FF7E00]/10 px-4 text-xs font-black uppercase tracking-[0.08em] text-[#FFD34E] transition hover:bg-[#FF7E00]/15 disabled:opacity-50"
              >
                {resendBusy ? "Sending…" : "Resend verification email"}
              </button>
              <button
                type="button"
                disabled={busy || (turnstile.enabled && !turnstile.ready)}
                onClick={() => void handleContinueWithPassword()}
                className="mt-3 min-h-[2.75rem] w-full rounded-xl border border-white/15 bg-white/5 px-4 text-xs font-black uppercase tracking-[0.08em] text-white/85 transition hover:bg-white/10 disabled:opacity-50"
              >
                {busy ? "Please wait…" : turnstile.enabled && !turnstile.ready ? "Complete security check…" : "Finish sign-up with password"}
              </button>
              <p className="mt-3 text-[11px] leading-relaxed text-emerald-100/55">
                Already confirmed your email? Use Continue with password. Otherwise wait 2 minutes between Resend attempts.
              </p>
              <button
                type="button"
                className="mt-4 text-xs font-bold uppercase tracking-wide text-[#FF7E00] underline-offset-4 hover:underline"
                onClick={() => {
                  setVerificationEmailSent(false);
                  setResendNotice(null);
                  setError(null);
                }}
              >
                Edit email and try again
              </button>
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <label htmlFor="tr-su-first" className={labelClass}>
                  First name
                </label>
                <input
                  id="tr-su-first"
                  type="text"
                  autoComplete="given-name"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="tr-su-last" className={labelClass}>
                  Last name
                </label>
                <input
                  id="tr-su-last"
                  type="text"
                  autoComplete="family-name"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="tr-su-username" className={labelClass}>
                Username
              </label>
              <input
                id="tr-su-username"
                type="text"
                autoComplete="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Unique handle"
                className={inputClass}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="tr-su-phone" className={labelClass}>
                Phone number
              </label>
              <input
                id="tr-su-phone"
                type="tel"
                autoComplete="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(555) 555-5555"
                className={inputClass}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="tr-su-zip" className={labelClass}>
                Primary service ZIP / postal code (optional)
              </label>
              <input
                id="tr-su-zip"
                type="text"
                autoComplete="postal-code"
                value={serviceZipCode}
                onChange={(e) => setServiceZipCode(e.target.value)}
                placeholder="94102, SW1A 1AA, etc."
                className={inputClass}
              />
              <p className="text-xs leading-relaxed text-white/40">
                Available worldwide — used for matching and your public profile. Set your own in-person service
                area and travel radius, or coach virtually from anywhere.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="tr-su-email" className={labelClass}>
                Email address
              </label>
              <input
                id="tr-su-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className={inputClass}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="tr-su-password" className={labelClass}>
                Password
              </label>
              <input
                id="tr-su-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className={inputClass}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="tr-su-confirm" className={labelClass}>
                Confirm password
              </label>
              <input
                id="tr-su-confirm"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                className={inputClass}
              />
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-xs text-white/50">
              <input
                id="tr-su-show-password"
                type="checkbox"
                checked={showPassword}
                onChange={(e) => setShowPassword(e.target.checked)}
                className="h-4 w-4 shrink-0 accent-[#FF7E00] focus:ring-2 focus:ring-[#FF7E00]/40 focus:ring-offset-0"
              />
              <span>Show passwords</span>
            </label>
            <p className="text-xs leading-relaxed text-white/40">
              Password must be at least 8 characters and include at least one capital letter and one special character.
            </p>

            <div className="flex gap-3 rounded-xl border border-white/[0.06] bg-[#0E1016]/80 px-4 py-4">
              <input
                id="tr-su-stay"
                type="checkbox"
                checked={stayLoggedIn}
                onChange={(e) => setStayLoggedIn(e.target.checked)}
                className="mt-1 h-4 w-4 shrink-0 accent-[#FF7E00] focus:ring-2 focus:ring-[#FF7E00]/40 focus:ring-offset-0"
              />
              <label htmlFor="tr-su-stay" className="text-sm leading-relaxed text-white/70">
                Stay logged in on this device after you create your account.
              </label>
            </div>

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

            <button
              type="submit"
              disabled={busy || verificationEmailSent || (turnstile.enabled && !turnstile.ready)}
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
              <span className="relative">
                {busy ? "Please wait…" : verificationEmailSent ? "Check your inbox" : "Create account"}
              </span>
            </button>
          </form>
            </>
          )}
        </div>

        <p className="mt-8 text-center text-xs text-white/40">
          <button
            type="button"
            onClick={() => router.push("/trainer/dashboard/login")}
            className="underline-offset-4 transition hover:text-white/60 hover:underline"
          >
            Already have an account?
          </button>
        </p>
      </div>
    </main>
  );
}
