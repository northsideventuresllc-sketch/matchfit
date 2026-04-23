"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { describePasswordPolicyViolations } from "@/lib/validations/client-register";
import { FormEvent, useState } from "react";

const inputClass =
  "w-full rounded-xl border border-white/10 bg-[#0E1016] px-4 py-3 text-[15px] text-white outline-none ring-[#FF7E00]/40 transition placeholder:text-white/25 focus:border-[#FF7E00]/40 focus:ring-2";

const labelClass = "text-xs font-semibold uppercase tracking-wide text-white/50";

function countPhoneDigits(phone: string): number {
  return phone.replace(/\D/g, "").length;
}

function simpleEmailValid(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export default function TrainerSignUpClient() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [stayLoggedIn, setStayLoggedIn] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
    if (!agreedToTerms) {
      setError("Please agree to the Terms of Service to continue.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/trainer/register", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          username: u,
          phone: phone.trim(),
          email: email.trim().toLowerCase(),
          password,
          agreedToTerms: true,
          stayLoggedIn,
        }),
      });
      const data = (await res.json()) as { error?: string; next?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not create your account.");
        return;
      }
      window.location.assign(data.next ?? "/trainer/onboarding");
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
            Back to log in
          </Link>
        </header>

        <h1 className="mt-10 text-2xl font-black tracking-tight sm:mt-12 sm:text-3xl">Create your trainer account</h1>
        <p className="mt-2 text-sm leading-relaxed text-white/55 sm:text-base">
          You will complete compliance steps after this screen. Use a strong password; you can enable two-factor
          authentication later just like clients.
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

            <div className="flex gap-3 rounded-xl border border-white/[0.06] bg-[#0E1016]/80 px-4 py-4">
              <input
                id="tr-su-terms"
                type="checkbox"
                required
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="mt-1 h-4 w-4 shrink-0 accent-[#FF7E00] focus:ring-2 focus:ring-[#FF7E00]/40 focus:ring-offset-0"
              />
              <label htmlFor="tr-su-terms" className="text-sm leading-relaxed text-white/70">
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
              <span className="relative">{busy ? "Please wait…" : "Continue to onboarding"}</span>
            </button>
          </form>
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
