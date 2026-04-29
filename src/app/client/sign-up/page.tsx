"use client";

import Image from "next/image";
import Link from "next/link";
import { TurnstileWidget, type TurnstileWidgetHandle } from "@/components/turnstile-widget";
import { navigateWithFullLoad } from "@/lib/navigate-full-load";
import { describePasswordPolicyViolations } from "@/lib/validations/client-register";
import { FormEvent, useMemo, useRef, useState } from "react";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

const inputClass =
  "w-full rounded-xl border border-white/10 bg-[#0E1016] px-4 py-3 text-[15px] text-white outline-none ring-[#FF7E00]/40 transition placeholder:text-white/25 focus:border-[#FF7E00]/40 focus:ring-2";

const labelClass = "text-xs font-semibold uppercase tracking-wide text-white/50";

function formatLocalYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function maxBirthdateForAge18(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 18);
  return formatLocalYmd(d);
}

function minBirthdate(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 120);
  return formatLocalYmd(d);
}

function isAtLeast18(birthYmd: string): boolean {
  if (!birthYmd) return false;
  const [y, m, day] = birthYmd.split("-").map(Number);
  if (!y || !m || !day) return false;
  const birth = new Date(y, m - 1, day);
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 18);
  return birth <= cutoff;
}

function isValidUsZip(zip: string): boolean {
  return /^\d{5}(-\d{4})?$/.test(zip.trim());
}

function countPhoneDigits(phone: string): number {
  return phone.replace(/\D/g, "").length;
}

function validateDobMessage(dob: string): string | null {
  if (!dob) return "Date of birth is required.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return "Enter a valid date of birth.";
  const [y, m, day] = dob.split("-").map(Number);
  if (!y || !m || !day) return "Enter a valid date of birth.";
  const birth = new Date(y, m - 1, day);
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  if (birth > endOfToday) return "Date of birth cannot be in the future.";
  if (!isAtLeast18(dob)) return "You must be at least 18 years old to create an account.";
  return null;
}

function simpleEmailValid(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

type OtpChannel = "EMAIL" | "SMS" | "VOICE";

export default function ClientSignUpPage() {
  const maxDob = useMemo(() => maxBirthdateForAge18(), []);
  const minDob = useMemo(() => minBirthdate(), []);

  const [wizardStep, setWizardStep] = useState<1 | 2>(1);
  const [awaitingCode, setAwaitingCode] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<OtpChannel | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [busy, setBusy] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [preferredName, setPreferredName] = useState("");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [stayLoggedIn, setStayLoggedIn] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [devPhoneMockTip, setDevPhoneMockTip] = useState(false);
  const turnstileRef = useRef<TurnstileWidgetHandle>(null);

  function turnstileField(): { turnstileToken?: string } {
    if (!TURNSTILE_SITE_KEY) return {};
    const token = turnstileRef.current?.getToken();
    return token ? { turnstileToken: token } : {};
  }

  function assertTurnstileOrSetError(): boolean {
    if (!TURNSTILE_SITE_KEY) return true;
    if (!turnstileRef.current?.getToken()) {
      setError("Please wait for the security check to finish, then try again.");
      return false;
    }
    return true;
  }

  function buildProfilePayload() {
    const fn = firstName.trim();
    const ln = lastName.trim();
    const pref = preferredName.trim();
    return {
      firstName: fn,
      lastName: ln,
      preferredName: pref,
      username: username.trim(),
      phone: phone.trim(),
      email: email.trim().toLowerCase(),
      password,
      zipCode: zipCode.trim(),
      dateOfBirth,
      agreedToTerms: true as const,
      stayLoggedIn,
    };
  }

  function validateStep1(): boolean {
    setError(null);
    if (!firstName.trim()) {
      setError("First name is required.");
      return false;
    }
    if (!lastName.trim()) {
      setError("Last name is required.");
      return false;
    }
    if (!preferredName.trim()) {
      setError("Preferred name is required.");
      return false;
    }
    const u = username.trim();
    if (!u) {
      setError("Username is required.");
      return false;
    }
    if (u.length < 3) {
      setError("Username must be at least 3 characters.");
      return false;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(u)) {
      setError("Username may only use letters, numbers, and underscores.");
      return false;
    }
    if (!phone.trim()) {
      setError("Phone number is required.");
      return false;
    }
    if (countPhoneDigits(phone) < 10) {
      setError("Enter a valid phone number with at least 10 digits.");
      return false;
    }
    if (!email.trim()) {
      setError("Email address is required.");
      return false;
    }
    if (!simpleEmailValid(email)) {
      setError("Enter a valid email address.");
      return false;
    }
    const pwMsg = describePasswordPolicyViolations(password);
    if (pwMsg) {
      setError(pwMsg);
      return false;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match. Fix your passwords before continuing.");
      return false;
    }
    if (!zipCode.trim()) {
      setError("ZIP code is required.");
      return false;
    }
    if (!isValidUsZip(zipCode)) {
      setError("Enter a valid US ZIP code (5 digits or ZIP+4).");
      return false;
    }
    const dobMsg = validateDobMessage(dateOfBirth);
    if (dobMsg) {
      setError(dobMsg);
      return false;
    }
    if (!agreedToTerms) {
      setError("Please agree to the Terms of Service to continue.");
      return false;
    }
    return true;
  }

  function handleStep1Next(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validateStep1()) return;
    setWizardStep(2);
    setAwaitingCode(false);
    setPendingId(null);
    setSelectedChannel(null);
    setOtpCode("");
    setError(null);
  }

  async function handleSkip2fa() {
    setError(null);
    if (!assertTurnstileOrSetError()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/client/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...buildProfilePayload(), skipTwoFactor: true, ...turnstileField() }),
      });
      const data = (await res.json()) as { error?: string; next?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not create your account.");
        turnstileRef.current?.reset();
        return;
      }
      // Full navigation so the httpOnly registration cookie is present before the billing page loads.
      navigateWithFullLoad(data.next ?? "/client/subscribe");
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSend2fa() {
    setError(null);
    setDevPhoneMockTip(false);
    if (!selectedChannel) {
      setError("Choose how you want to receive your verification code.");
      return;
    }
    if (!assertTurnstileOrSetError()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/client/register/pending-2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...buildProfilePayload(),
          twoFactorMethod: selectedChannel,
          ...turnstileField(),
        }),
      });
      const data = (await res.json()) as { error?: string; pendingId?: string; devPhoneMock?: boolean };
      if (!res.ok) {
        setError(data.error ?? "Could not send the verification code.");
        turnstileRef.current?.reset();
        return;
      }
      if (data.pendingId) {
        setPendingId(data.pendingId);
        setAwaitingCode(true);
        setOtpCode("");
        setDevPhoneMockTip(Boolean(data.devPhoneMock));
      }
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleVerify2fa(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!pendingId || !/^\d{6}$/.test(otpCode)) {
      setError("Enter the 6-digit code.");
      return;
    }
    if (!assertTurnstileOrSetError()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/client/register/complete-pending", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pendingId, code: otpCode, ...turnstileField() }),
      });
      const data = (await res.json()) as { error?: string; next?: string };
      if (!res.ok) {
        setError(data.error ?? "Verification failed.");
        turnstileRef.current?.reset();
        return;
      }
      navigateWithFullLoad(data.next ?? "/client/subscribe");
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
          <Link href="/client" className="flex items-center gap-3 opacity-90 transition hover:opacity-100">
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl sm:h-14 sm:w-14">
              <Image src="/logo.png" alt="Match Fit" fill className="object-contain" sizes="56px" />
            </div>
            <div className="leading-none">
              <p className="text-sm font-black tracking-tight sm:text-base">
                <span className="text-[#E8EAEF]">Match</span>{" "}
                <span className="text-[#E32B2B]">Fit</span>
              </p>
            </div>
          </Link>
          <Link
            href="/client"
            className="text-xs font-semibold uppercase tracking-wide text-white/50 transition hover:text-white/75"
          >
            Back to log in
          </Link>
        </header>

        <h1 className="mt-10 text-2xl font-black tracking-tight sm:mt-12 sm:text-3xl">
          {wizardStep === 1 ? "Create your account" : "Two-factor authentication"}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-white/55 sm:text-base">
          {wizardStep === 1
            ? "Tell us a bit about yourself. You must be 18 or older to join."
            : awaitingCode
              ? "Enter the code we sent you to finish creating your account."
              : "Add an extra layer of security, or skip and turn this on later in settings."}
        </p>

        <div className="mt-8 rounded-3xl border border-white/[0.08] bg-[#12151C]/90 p-6 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.85)] backdrop-blur-xl sm:p-8">
          {error ? (
            <p
              className="mb-5 rounded-xl border border-[#E32B2B]/35 bg-[#E32B2B]/10 px-4 py-3 text-sm text-[#FFB4B4]"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          {wizardStep === 1 ? (
            <form onSubmit={handleStep1Next} className="flex flex-col gap-5" noValidate>
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <label htmlFor="su-first" className={labelClass}>
                    First name
                  </label>
                  <input
                    id="su-first"
                    type="text"
                    autoComplete="given-name"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="su-last" className={labelClass}>
                    Last name
                  </label>
                  <input
                    id="su-last"
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
                <label htmlFor="su-preferred" className={labelClass}>
                  Preferred name{" "}
                  <span className="font-normal normal-case text-white/35">(shown on your profile)</span>
                </label>
                <input
                  id="su-preferred"
                  type="text"
                  autoComplete="nickname"
                  required
                  value={preferredName}
                  onChange={(e) => setPreferredName(e.target.value)}
                  placeholder="How you want to be addressed"
                  className={inputClass}
                />
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="su-username" className={labelClass}>
                  Username
                </label>
                <input
                  id="su-username"
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
                <label htmlFor="su-phone" className={labelClass}>
                  Phone number
                </label>
                <input
                  id="su-phone"
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
                <label htmlFor="su-email" className={labelClass}>
                  Email address
                </label>
                <input
                  id="su-email"
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
                <label htmlFor="su-password" className={labelClass}>
                  Password
                </label>
                <input
                  id="su-password"
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
                <label htmlFor="su-confirm" className={labelClass}>
                  Confirm password
                </label>
                <input
                  id="su-confirm"
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
                  id="su-show-password"
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

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <label htmlFor="su-zip" className={labelClass}>
                    Zip code
                  </label>
                  <input
                    id="su-zip"
                    type="text"
                    inputMode="numeric"
                    autoComplete="postal-code"
                    required
                    value={zipCode}
                    onChange={(e) => setZipCode(e.target.value)}
                    placeholder="30301"
                    pattern="[0-9]{5}(-[0-9]{4})?"
                    title="Enter a valid US ZIP code"
                    className={inputClass}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="su-dob" className={labelClass}>
                    Date of birth <span className="font-normal normal-case text-white/35">(18+)</span>
                  </label>
                  <input
                    id="su-dob"
                    type="date"
                    required
                    min={minDob}
                    max={maxDob}
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    style={{ colorScheme: "dark" }}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="flex gap-3 rounded-xl border border-white/[0.06] bg-[#0E1016]/80 px-4 py-4">
                <input
                  id="su-stay"
                  type="checkbox"
                  checked={stayLoggedIn}
                  onChange={(e) => setStayLoggedIn(e.target.checked)}
                  className="mt-1 h-4 w-4 shrink-0 accent-[#FF7E00] focus:ring-2 focus:ring-[#FF7E00]/40 focus:ring-offset-0"
                />
                <label htmlFor="su-stay" className="text-sm leading-relaxed text-white/70">
                  Stay logged in on this device after you subscribe (uses a longer browser session when enabled).
                </label>
              </div>

              <div className="flex gap-3 rounded-xl border border-white/[0.06] bg-[#0E1016]/80 px-4 py-4">
                <input
                  id="su-terms"
                  type="checkbox"
                  required
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  className="mt-1 h-4 w-4 shrink-0 accent-[#FF7E00] focus:ring-2 focus:ring-[#FF7E00]/40 focus:ring-offset-0"
                />
                <label htmlFor="su-terms" className="text-sm leading-relaxed text-white/70">
                  I agree to the{" "}
                  <Link href="/terms" className="font-semibold text-[#FF7E00] underline-offset-2 hover:underline">
                    Terms of Service
                  </Link>
                  .
                </label>
              </div>

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
                <span className="relative">{busy ? "Please wait…" : "Next"}</span>
              </button>
            </form>
          ) : (
            <>
              {TURNSTILE_SITE_KEY ? (
                <div className="mb-6 flex justify-center">
                  <TurnstileWidget ref={turnstileRef} siteKey={TURNSTILE_SITE_KEY} />
                </div>
              ) : null}
              {!awaitingCode ? (
            <div className="flex flex-col gap-6">
              <p className="text-sm leading-relaxed text-white/55">
                Choose where we should send a one-time code. SMS and voice use the phone number you entered; email uses
                your account address. In local development, SMS and voice are mocked: the code is printed in the terminal
                running the app, not sent by Twilio.
              </p>

              <div className="flex flex-col gap-3">
                {(
                  [
                    { id: "EMAIL" as const, title: "Email", desc: "Send a code to your email address." },
                    { id: "SMS" as const, title: "Text message", desc: "Send a code by SMS to your phone." },
                    { id: "VOICE" as const, title: "Phone call", desc: "Receive a voice call that reads your code." },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSelectedChannel(opt.id)}
                    className={`rounded-xl border px-4 py-3 text-left transition ${
                      selectedChannel === opt.id
                        ? "border-[#FF7E00]/60 bg-[#FF7E00]/10"
                        : "border-white/10 bg-[#0E1016] hover:border-white/20"
                    }`}
                  >
                    <p className="text-sm font-bold text-white">{opt.title}</p>
                    <p className="mt-1 text-xs text-white/45">{opt.desc}</p>
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleSkip2fa}
                  className="flex min-h-[3.25rem] flex-1 items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] px-4 text-sm font-black uppercase tracking-[0.08em] text-white transition hover:border-white/25 hover:bg-white/[0.07] disabled:opacity-50"
                >
                  Skip for now
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleSend2fa}
                  className="group relative isolate flex min-h-[3.25rem] flex-1 items-center justify-center overflow-hidden rounded-xl px-4 text-sm font-black uppercase tracking-[0.08em] text-[#0B0C0F] shadow-[0_20px_50px_-18px_rgba(227,43,43,0.45)] transition active:translate-y-px disabled:opacity-50"
                >
                  <span
                    aria-hidden
                    className="absolute inset-0 bg-[linear-gradient(135deg,#FFD34E_0%,#FF7E00_45%,#E32B2B_100%)]"
                  />
                  <span className="relative">{busy ? "Please wait…" : "Send verification code"}</span>
                </button>
              </div>

              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setWizardStep(1);
                  setError(null);
                }}
                className="text-center text-xs font-semibold uppercase tracking-wide text-white/40 transition hover:text-white/65"
              >
                Back to details
              </button>
            </div>
          ) : (
            <form onSubmit={handleVerify2fa} className="flex flex-col gap-5">
              {devPhoneMockTip ? (
                <p
                  className="rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-4 py-3 text-sm leading-relaxed text-emerald-100"
                  role="status"
                >
                  Development mode: your code was not sent by SMS or phone. Check the terminal where{" "}
                  <span className="font-mono text-emerald-50">npm run dev</span> is running, copy the 6-digit code, and
                  enter it below. Verification works the same as production.
                </p>
              ) : null}
              <div className="flex flex-col gap-2">
                <label htmlFor="su-otp" className={labelClass}>
                  Verification code
                </label>
                <input
                  id="su-otp"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="6-digit code"
                  className={inputClass}
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
                <span className="relative">{busy ? "Please wait…" : "Verify and create account"}</span>
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setAwaitingCode(false);
                  setPendingId(null);
                  setOtpCode("");
                  setError(null);
                  setDevPhoneMockTip(false);
                }}
                className="text-center text-xs font-semibold uppercase tracking-wide text-white/40 transition hover:text-white/65"
              >
                Choose a different method
              </button>
            </form>
              )}
            </>
          )}
        </div>

        <p className="mt-8 text-center text-xs text-white/40">
          <Link href="/" className="underline-offset-4 transition hover:text-white/60 hover:underline">
            Home
          </Link>
        </p>
      </div>
    </main>
  );
}
