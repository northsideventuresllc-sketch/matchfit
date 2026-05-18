"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { TurnstileWidget, type TurnstileWidgetHandle } from "@/components/turnstile-widget";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

const inputClass =
  "w-full rounded-xl border border-white/10 bg-[#0E1016] px-4 py-3 text-[15px] text-white outline-none ring-[#FF7E00]/40 transition placeholder:text-white/25 focus:border-[#FF7E00]/40 focus:ring-2";

const labelClass = "text-xs font-semibold uppercase tracking-wide text-white/50";

export default function ClientWaitlistPage() {
  const turnstileRef = useRef<TurnstileWidgetHandle>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [desiredUsername, setDesiredUsername] = useState("");
  const [homeZipCode, setHomeZipCode] = useState("");
  const [gatesOn, setGatesOn] = useState<boolean | null>(null);

  useEffect(() => {
    void fetch("/api/public/beta-launch-status")
      .then((r) => r.json())
      .then((d: { gatesEnabled?: boolean; clientWaitlistOpen?: boolean }) => {
        setGatesOn(d.gatesEnabled === true && d.clientWaitlistOpen === true);
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
      const res = await fetch("/api/public/beta-waitlist/client", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          desiredUsername: desiredUsername.trim(),
          homeZipCode: homeZipCode.trim(),
          ...(TURNSTILE_SITE_KEY ? { turnstileToken: turnstileRef.current?.getToken() } : {}),
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not join waitlist.");
        turnstileRef.current?.reset();
        return;
      }
      setDone(true);
    } catch {
      setError("Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative min-h-dvh overflow-x-hidden bg-[#0B0C0F] text-white antialiased">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(255,211,78,0.12),transparent_55%),radial-gradient(ellipse_90%_60%_at_100%_0%,rgba(255,126,0,0.08),transparent_50%)]"
      />
      <div className="relative z-10 mx-auto max-w-lg px-5 py-12 sm:px-8">
        <Link href="/" className="text-sm font-semibold text-white/50 transition hover:text-white/80">
          ← Home
        </Link>
        <h1 className="mt-6 text-2xl font-black tracking-tight sm:text-3xl">Client waitlist</h1>
        <p className="mt-3 text-sm leading-relaxed text-white/60">
          Atlanta metro beta — join the list when memberships are full. You will get a confirmation email, then an invite
          link when a slot opens (typically within 30 days to complete sign-up).
        </p>
        {gatesOn === false ? (
          <p className="mt-6 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-50">
            The client waitlist is not open right now — slots may still be available.{" "}
            <Link href="/client/sign-up" className="font-semibold text-[#FF7E00] underline-offset-2 hover:underline">
              Try signing up
            </Link>
          </p>
        ) : null}
        {done ? (
          <div className="mt-8 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-5 py-5" role="status">
            <p className="font-semibold text-emerald-50">You are on the list</p>
            <p className="mt-2 text-sm leading-relaxed text-emerald-100/90">
              Check your inbox for confirmation. We will email you a secure invite when a membership slot opens.
            </p>
          </div>
        ) : gatesOn ? (
          <form onSubmit={(ev) => void onSubmit(ev)} className="mt-8 flex flex-col gap-4">
            {error ? (
              <p className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100" role="alert">
                {error}
              </p>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2">
                <span className={labelClass}>First name</span>
                <input className={inputClass} value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
              </label>
              <label className="flex flex-col gap-2">
                <span className={labelClass}>Last name</span>
                <input className={inputClass} value={lastName} onChange={(e) => setLastName(e.target.value)} required />
              </label>
            </div>
            <label className="flex flex-col gap-2">
              <span className={labelClass}>Email</span>
              <input type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            <label className="flex flex-col gap-2">
              <span className={labelClass}>Phone</span>
              <input type="tel" className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} required />
            </label>
            <label className="flex flex-col gap-2">
              <span className={labelClass}>Desired username</span>
              <input className={inputClass} value={desiredUsername} onChange={(e) => setDesiredUsername(e.target.value)} required />
            </label>
            <label className="flex flex-col gap-2">
              <span className={labelClass}>Home ZIP (Atlanta metro)</span>
              <input className={inputClass} value={homeZipCode} onChange={(e) => setHomeZipCode(e.target.value)} required placeholder="30301" />
            </label>
            {TURNSTILE_SITE_KEY ? <TurnstileWidget ref={turnstileRef} siteKey={TURNSTILE_SITE_KEY} /> : null}
            <button
              type="submit"
              disabled={busy}
              className="mt-2 flex min-h-[3.25rem] items-center justify-center rounded-xl bg-[linear-gradient(135deg,#FFD34E_0%,#FF7E00_45%,#E32B2B_100%)] px-4 text-sm font-black uppercase tracking-[0.08em] text-[#0B0C0F] disabled:opacity-50"
            >
              {busy ? "Submitting…" : "Join waitlist"}
            </button>
          </form>
        ) : gatesOn === null ? (
          <p className="mt-8 text-sm text-white/50">Loading…</p>
        ) : null}
      </div>
    </main>
  );
}
