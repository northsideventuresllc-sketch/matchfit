"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { TurnstileWidget, type TurnstileWidgetHandle } from "@/components/turnstile-widget";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

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
    <main className="min-h-dvh bg-[#0B0C0F] px-5 py-12 text-white">
      <div className="mx-auto max-w-lg">
        <Link href="/" className="text-sm text-white/50 hover:text-white/80">
          ← Home
        </Link>
        <h1 className="mt-6 text-2xl font-black tracking-tight">Client waitlist</h1>
        <p className="mt-2 text-sm text-white/55">
          Atlanta metro beta — join the list when memberships are full. You will receive a confirmation email, then an invite
          when a slot opens.
        </p>
        {gatesOn === false ? (
          <p className="mt-6 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-50">
            Client waitlist is not open right now (beta gates may be off or slots are still available).
          </p>
        ) : null}
        {done ? (
          <p className="mt-6 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-50" role="status">
            You are on the list. Check your email for confirmation.
          </p>
        ) : (
          <form onSubmit={(ev) => void onSubmit(ev)} className="mt-8 flex flex-col gap-4">
            {error ? (
              <p className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100" role="alert">
                {error}
              </p>
            ) : null}
            <input
              required
              className="rounded-xl border border-white/10 bg-[#0E1016] px-4 py-3 text-sm"
              placeholder="First name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
            <input
              required
              className="rounded-xl border border-white/10 bg-[#0E1016] px-4 py-3 text-sm"
              placeholder="Last name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
            <input
              required
              type="email"
              className="rounded-xl border border-white/10 bg-[#0E1016] px-4 py-3 text-sm"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              required
              className="rounded-xl border border-white/10 bg-[#0E1016] px-4 py-3 text-sm"
              placeholder="Phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <input
              required
              className="rounded-xl border border-white/10 bg-[#0E1016] px-4 py-3 text-sm"
              placeholder="Desired username"
              value={desiredUsername}
              onChange={(e) => setDesiredUsername(e.target.value)}
            />
            <input
              required
              className="rounded-xl border border-white/10 bg-[#0E1016] px-4 py-3 text-sm"
              placeholder="Home ZIP (Atlanta metro)"
              value={homeZipCode}
              onChange={(e) => setHomeZipCode(e.target.value)}
            />
            {TURNSTILE_SITE_KEY ? <TurnstileWidget ref={turnstileRef} siteKey={TURNSTILE_SITE_KEY} /> : null}
            <button
              type="submit"
              disabled={busy || gatesOn !== true}
              className="rounded-xl bg-gradient-to-r from-cyan-400 to-indigo-500 py-3 text-sm font-black uppercase tracking-wide text-[#050608] disabled:opacity-40"
            >
              {busy ? "Submitting…" : "Join waitlist"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
