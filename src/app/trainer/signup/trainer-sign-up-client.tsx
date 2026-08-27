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
import { COUNTRY_OPTIONS } from "@/lib/user-location";
import { postalRuleForCountry, postalValidationError } from "@/lib/postal-rules";
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
    return "Your email is not confirmed yet. Finish creating your account, then confirm it from your dashboard.";
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
  const [countryCode, setCountryCode] = useState("");
  const [serviceZipCode, setServiceZipCode] = useState("");
  // What this country calls its postal code, whether it is required, and whether it has one
  // at all. `requirement: "none"` means the question is not rendered — several countries,
  // notably the UAE, have no postal system, and we also ask nothing for any country we have
  // no rule for (JB: keep the process simple).
  const postalRule = postalRuleForCountry(countryCode);
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

  // Sign-up is a single step now — submitting goes straight to the Fitness Pro agreement, so
  // there is no longer a "verification email sent" step between the two.
  const wizardFunnelStep = useMemo(
    () => ({
      funnel: "trainer" as const,
      step_id: "sign_up_form_active",
      step_name: "Sign-up form",
      step_index: 1,
    }),
    [],
  );
  useMetaSignupFunnelStep(wizardFunnelStep);

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
    country?: string;
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
        ...(registerCore.country ? { country: registerCore.country } : {}),
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
    const postalMsg = postalValidationError(countryCode, serviceZipCode);
    if (postalMsg) {
      setError(postalMsg);
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
        serviceZipCode: postalRule.requirement === "none" ? "" : serviceZipCode.trim(),
        ...(countryCode ? { country: countryCode } : {}),
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
          serviceZipCode: postalRule.requirement === "none" ? "" : serviceZipCode.trim(),
          ...(countryCode ? { country: countryCode } : {}),
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
            serviceZipCode: postalRule.requirement === "none" ? "" : serviceZipCode.trim(),
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
              serviceZipCode: postalRule.requirement === "none" ? "" : serviceZipCode.trim(),
              ...(countryCode ? { country: countryCode } : {}),
              ...(betaInviteFromUrl ? { betaInviteToken: betaInviteFromUrl } : {}),
            });
            navigateWithFullLoad(data.next ?? "/trainer/signup/terms");
            return;
          }

          // The browser sign-up above created the Supabase user, so the agreement page can
          // complete sign-up. Confirming the email happens on the dashboard afterwards.
          trackMetaLead("trainer");
          navigateWithFullLoad("/trainer/signup/terms");
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
              turnstile.reset();
              setBusy(false);
            }
            return;
          }
          // A cooldown means an earlier attempt already created the Supabase user, so sign-up
          // can continue — they just cannot have another email yet, and the dashboard will
          // offer one later. Anything else may have left no user behind, and pressing on would
          // fail at the agreement step, so surface it on the form instead.
          if (delivery.code === "RESEND_COOLDOWN") {
            navigateWithFullLoad("/trainer/signup/terms");
            return;
          }
          setError(delivery.error ?? "We could not send the verification email.");
          turnstile.reset();
          setBusy(false);
          return;
        }

        // Straight to the Fitness Pro agreement — no check-your-inbox stop (JB, 2026-08-04).
        // The confirmation email is already on its way; the dashboard prompts until it is used.
        trackMetaLead("trainer");
        navigateWithFullLoad("/trainer/signup/terms");
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
        serviceZipCode: postalRule.requirement === "none" ? "" : serviceZipCode.trim(),
        ...(countryCode ? { country: countryCode } : {}),
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
              <label htmlFor="tr-su-country" className={labelClass}>
                Country
              </label>
              <select
                id="tr-su-country"
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                className={inputClass}
              >
                <option value="">Select your country</option>
                {COUNTRY_OPTIONS.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>
              <p className="text-xs leading-relaxed text-white/40">
                Match Fit is available worldwide. Coach virtually from anywhere, or set your own in-person
                service area and travel distance.
              </p>
            </div>

            {postalRule.requirement === "none" ? null : (
              <div className="flex flex-col gap-2">
                <label htmlFor="tr-su-zip" className={labelClass}>
                  {postalRule.label}{" "}
                  {postalRule.requirement === "optional" ? (
                    <span className="font-normal normal-case text-white/35">(optional)</span>
                  ) : null}
                </label>
                <input
                  id="tr-su-zip"
                  type="text"
                  autoComplete="postal-code"
                  maxLength={20}
                  value={serviceZipCode}
                  onChange={(e) => setServiceZipCode(e.target.value)}
                  placeholder={postalRule.example}
                  className={inputClass}
                />
                <p className="text-xs leading-relaxed text-white/40">
                  Used for matching and your public profile.
                </p>
              </div>
            )}

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
              Password must be at least 8 characters and include at least one capital letter, one number, and one special character.
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
              disabled={busy || (turnstile.enabled && !turnstile.ready)}
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
                {busy ? "Please wait…" : "Create account"}
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
