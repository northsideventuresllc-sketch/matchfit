"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { MatchFitSocialLinks } from "@/components/match-fit-social-links";
import { TurnstileWidget, type TurnstileWidgetHandle } from "@/components/turnstile-widget";
import { getTrainerFoundingBgPercentMax } from "@/lib/match-fit-launch-promotions";
import { MATCH_FIT_PRODUCT_VERSION_LABEL } from "@/lib/match-fit-product-version";

const TRAINER_FOUNDING_CAP = getTrainerFoundingBgPercentMax();

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

const inputClass =
  "w-full rounded-xl border border-white/10 bg-[#0E1016] px-4 py-3 text-[15px] text-white outline-none ring-[#FF7E00]/40 transition placeholder:text-white/25 focus:border-[#FF7E00]/40 focus:ring-2";

const labelClass = "text-xs font-semibold uppercase tracking-wide text-white/50";

export default function TrainerWaitlistPage() {
  const turnstileRef = useRef<TurnstileWidgetHandle>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [desiredUsername, setDesiredUsername] = useState("");
  const [serviceZipCode, setServiceZipCode] = useState("");
  const [gatesOn, setGatesOn] = useState<boolean | null>(null);

  useEffect(() => {
    void fetch("/api/public/beta-launch-status")
      .then((r) => r.json())
      .then((d: { gatesEnabled?: boolean; trainerWaitlistOpen?: boolean }) => {
        setGatesOn(d.gatesEnabled === true && d.trainerWaitlistOpen === true);
      })
      .catch(() => setGatesOn(false));
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (TURNSTILE_SITE_KEY && !turnstileRef.current?.getToken()) {
      setError("Please complete the security check.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/public/beta-waitlist/trainer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          desiredUsername: desiredUsername.trim(),
          serviceZipCode: serviceZipCode.trim(),
          ...(TURNSTILE_SITE_KEY ? { turnstileToken: turnstileRef.current?.getToken() } : {}),
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not join waitlist.");
        turnstileRef.current?.reset();
        return;
      }
      setSubmittedEmail(email.trim());
      setDone(true);
    } catch {
      setError("Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative min-h-dvh overflow-x-hidden bg-[#0B0C0F] text-white antialiased">
      {/* Background gradient blobs */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(255,211,78,0.12),transparent_55%),radial-gradient(ellipse_90%_60%_at_100%_0%,rgba(255,126,0,0.08),transparent_50%),radial-gradient(ellipse_70%_50%_at_0%_100%,rgba(227,43,43,0.07),transparent_55%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(45,52,64,0.3)_0%,transparent_35%,transparent_70%,rgba(11,12,15,0.85)_100%)]"
      />

      <div className="relative z-10 mx-auto max-w-lg px-5 py-12 sm:px-8">
        {/* Header */}
        <header className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl">
              <Image
                src="/logo.png"
                alt="Match Fit"
                fill
                className="object-contain"
                priority
                sizes="40px"
              />
            </div>
            <div className="leading-none">
              <p className="text-sm font-black tracking-tight">
                <span className="text-[#E8EAEF]">Match</span>{" "}
                <span className="text-[#E32B2B]">Fit</span>
              </p>
              <p className="mt-0.5 text-[0.6rem] font-bold uppercase tracking-[0.18em] text-[#FF7E00]/80">
                Version {MATCH_FIT_PRODUCT_VERSION_LABEL}
              </p>
            </div>
          </Link>
        </header>

        <Link
          href="/"
          className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-white/50 transition hover:text-white/80"
        >
          <span aria-hidden>&#8592;</span> Back to Home
        </Link>

        {/* Page title */}
        <div className="mt-8">
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
            <span className="bg-gradient-to-r from-[#FFD34E] via-[#FF7E00] to-[#E32B2B] bg-clip-text text-transparent">
              Trainer Waitlist
            </span>
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-white/60">
            All beta slots are currently full. Reserve your username now — you will be notified by
            email when a slot opens. You will have 30 days to complete your account setup once
            invited.
          </p>
        </div>

        {/* Founding-member promo notice */}
        <div className="mt-4 rounded-2xl border border-[#FF7E00]/20 bg-[#12151C]/75 px-4 py-3 backdrop-blur-xl">
          <p className="text-xs leading-relaxed text-white/55">
            <span className="font-semibold text-[#FF7E00]">Note:</span> Founding member promos (20%
            BG fee / 14-day free trial) apply only to the first {TRAINER_FOUNDING_CAP} trainers who sign up
            directly.
            Waitlist users receive standard pricing when their slot opens.
          </p>
        </div>

        <MatchFitSocialLinks variant="compact" className="mt-6" />

        {/* Gates-closed banner */}
        {gatesOn === false ? (
          <p className="mt-6 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-50">
            Trainer waitlist is not open right now.{" "}
            <Link
              href="/trainer/signup"
              className="font-semibold text-[#FF7E00] underline-offset-2 hover:underline"
            >
              Try signing up
            </Link>
          </p>
        ) : null}

        {/* Success card */}
        {done ? (
          <div
            className="mt-8 rounded-3xl border border-emerald-400/25 bg-[#12151C]/75 px-6 py-6 backdrop-blur-xl"
            role="status"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/20">
                <svg
                  className="h-5 w-5 text-emerald-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-lg font-black tracking-tight text-emerald-300">
                {"You're on the list!"}
              </p>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-white/70">
              We sent a confirmation to{" "}
              <span className="font-semibold text-white">{submittedEmail}</span>. When a slot opens,
              you will receive an invite to finish setting up your account. Your reserved username
              will be waiting for you.
            </p>
            <Link
              href="/"
              className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-[#FF7E00] transition hover:text-[#FFD34E]"
            >
              <span aria-hidden>&#8592;</span> Back to Home
            </Link>
          </div>
        ) : gatesOn ? (
          <div className="mt-8 rounded-3xl border border-white/[0.08] bg-[#12151C]/75 px-6 py-6 backdrop-blur-xl">
            <form onSubmit={(ev) => void onSubmit(ev)} className="flex flex-col gap-5">
              {error ? (
                <p
                  className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100"
                  role="alert"
                >
                  {error}
                </p>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-2">
                  <span className={labelClass}>First name</span>
                  <input
                    required
                    className={inputClass}
                    placeholder="Jane"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                  />
                </label>
                <label className="flex flex-col gap-2">
                  <span className={labelClass}>Last name</span>
                  <input
                    required
                    className={inputClass}
                    placeholder="Smith"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                </label>
              </div>

              <label className="flex flex-col gap-2">
                <span className={labelClass}>Email</span>
                <input
                  required
                  type="email"
                  className={inputClass}
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className={labelClass}>Phone</span>
                <input
                  required
                  type="tel"
                  className={inputClass}
                  placeholder="(404) 555-0100"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </label>

              <div className="flex flex-col gap-2">
                <label className="flex flex-col gap-2">
                  <span className={labelClass}>Desired username</span>
                  <input
                    required
                    className={inputClass}
                    placeholder="janesmith"
                    value={desiredUsername}
                    onChange={(e) => setDesiredUsername(e.target.value)}
                  />
                </label>
                <p className="text-xs text-white/40">
                  3{"–32"} characters, letters, numbers, and underscores only. Your username is
                  reserved when you join the waitlist.
                </p>
              </div>

              <label className="flex flex-col gap-2">
                <span className={labelClass}>Service ZIP (Atlanta metro)</span>
                <input
                  required
                  className={inputClass}
                  placeholder="30301"
                  value={serviceZipCode}
                  onChange={(e) => setServiceZipCode(e.target.value)}
                />
              </label>

              {TURNSTILE_SITE_KEY ? (
                <TurnstileWidget ref={turnstileRef} siteKey={TURNSTILE_SITE_KEY} />
              ) : null}

              <button
                type="submit"
                disabled={busy || gatesOn !== true}
                className="mt-1 flex min-h-[3.25rem] items-center justify-center rounded-xl bg-[linear-gradient(135deg,#FFD34E_0%,#FF7E00_45%,#E32B2B_100%)] px-4 text-sm font-black uppercase tracking-[0.08em] text-[#0B0C0F] transition disabled:opacity-50"
              >
                {busy ? "Submitting…" : "Join Waitlist"}
              </button>
            </form>
          </div>
        ) : gatesOn === null ? (
          <p className="mt-8 text-sm text-white/50">Loading{"…"}</p>
        ) : null}
      </div>
    </main>
  );
}
