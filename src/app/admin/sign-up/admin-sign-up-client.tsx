"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useRef, useState } from "react";
import { TurnstileWidget, type TurnstileWidgetHandle } from "@/components/turnstile-widget";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

const DECISION_COPY: Record<string, string> = {
  approved:
    "This administrator request was approved. You can sign in from the staff portal with your eight-character code and the password you chose.",
  denied: "This request was denied. Contact Match Fit leadership if you believe this was a mistake.",
  invalid: "That approval link is invalid or expired.",
  missing: "No pending request was found for this link.",
  already: "This request was already handled.",
  clash:
    "Approval could not complete because another account already uses this email or derived administrator code. The pending request was closed.",
  bad_code: "Approval could not derive a valid administrator code from the saved legal name and birth date.",
  error: "Something went wrong processing the decision. Try again or contact engineering.",
};

export function AdminSignUpClient(props: { decision?: string }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const turnstileRef = useRef<TurnstileWidgetHandle>(null);

  const decisionNote = props.decision ? DECISION_COPY[props.decision] : null;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (TURNSTILE_SITE_KEY) {
      const token = turnstileRef.current?.getToken();
      if (!token) {
        setError("Please wait for the security check to finish, then try again.");
        return;
      }
    }
    setBusy(true);
    try {
      const turnstileToken = TURNSTILE_SITE_KEY ? turnstileRef.current?.getToken() : undefined;
      const res = await fetch("/api/admin/register-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          dateOfBirth: dateOfBirth.trim(),
          email: email.trim(),
          password,
          ...(turnstileToken ? { turnstileToken } : {}),
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not submit.");
        turnstileRef.current?.reset();
        return;
      }
      setDone(true);
      setPassword("");
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative min-h-dvh overflow-x-hidden bg-[#050608] text-white antialiased">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_100%_70%_at_50%_-15%,rgba(34,211,238,0.1),transparent_55%)]"
      />

      <div className="relative z-10 mx-auto flex min-h-dvh max-w-lg flex-col px-5 pb-16 pt-10 sm:px-8 sm:pb-20 sm:pt-14">
        <header className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-3 opacity-90 transition hover:opacity-100">
            <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl">
              <Image src="/logo.png" alt="Match Fit" fill className="object-contain" sizes="44px" />
            </div>
            <span className="text-sm font-black tracking-tight">
              <span className="text-[#E8EAEF]">Match</span> <span className="text-[#E32B2B]">Fit</span>
            </span>
          </Link>
        </header>

        <div className="mt-10 flex flex-1 flex-col">
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Administrator onboarding</h1>
          <p className="mt-3 text-sm leading-relaxed text-white/55">
            Complete this form so Match Fit leadership receives your details. When they approve the request, your staff code is
            derived from your legal first name, legal last name, and birth date (two letters + two letters + MMDD).
          </p>
          <p className="mt-3 rounded-xl border border-amber-400/30 bg-amber-500/[0.07] px-3 py-2.5 text-xs leading-relaxed text-amber-50/95 sm:text-sm">
            <span className="font-semibold text-amber-100">First beta.</span> Match Fit’s initial beta does not yet include the
            completed Administrator Portal—that work is scheduled for when version 1.0 goes live. Requests and approvals during beta may
            evolve before launch.
          </p>

          {decisionNote ? (
            <p
              className={`mt-6 rounded-2xl border px-4 py-3 text-sm leading-relaxed ${
                props.decision === "approved"
                  ? "border-emerald-400/35 bg-emerald-500/10 text-emerald-100"
                  : "border-white/[0.12] bg-white/[0.04] text-white/75"
              }`}
              role="status"
            >
              {decisionNote}
            </p>
          ) : null}

          <div className="mx-auto mt-10 w-full max-w-md">
            {done ? (
              <div className="rounded-3xl border border-emerald-400/30 bg-emerald-500/10 p-6 text-sm text-emerald-50">
                <p className="font-bold">Request received.</p>
                <p className="mt-2 text-emerald-100/85">
                  Check with Match Fit operators if you need status updates. You will use the password you chose once the account is
                  approved.
                </p>
                <Link
                  href="/admin/login"
                  className="mt-6 inline-flex min-h-[2.75rem] items-center justify-center rounded-xl bg-emerald-500 px-4 text-xs font-black uppercase tracking-[0.1em] text-[#052e1f]"
                >
                  Back to staff sign-in
                </Link>
              </div>
            ) : (
              <div className="rounded-3xl border border-white/[0.08] bg-[#0c0f14]/95 p-6 backdrop-blur-xl sm:p-8">
                {error ? (
                  <p className="mb-4 rounded-xl border border-[#E32B2B]/35 bg-[#E32B2B]/10 px-4 py-3 text-sm text-[#FFB4B4]" role="alert">
                    {error}
                  </p>
                ) : null}

                <form className="flex flex-col gap-4" onSubmit={(e) => void handleSubmit(e)}>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-semibold uppercase tracking-wide text-white/45">Legal first name</label>
                      <input
                        required
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="rounded-xl border border-white/[0.1] bg-[#07080c] px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400/35 focus:ring-2 focus:ring-cyan-400/25"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-semibold uppercase tracking-wide text-white/45">Legal last name</label>
                      <input
                        required
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="rounded-xl border border-white/[0.1] bg-[#07080c] px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400/35 focus:ring-2 focus:ring-cyan-400/25"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wide text-white/45">
                      Date of birth (YYYY-MM-DD)
                    </label>
                    <input
                      required
                      type="date"
                      value={dateOfBirth}
                      onChange={(e) => setDateOfBirth(e.target.value)}
                      className="rounded-xl border border-white/[0.1] bg-[#07080c] px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400/35 focus:ring-2 focus:ring-cyan-400/25"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wide text-white/45">Work email</label>
                    <input
                      required
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="rounded-xl border border-white/[0.1] bg-[#07080c] px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400/35 focus:ring-2 focus:ring-cyan-400/25"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wide text-white/45">Password (12+ characters)</label>
                    <input
                      required
                      type="password"
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="rounded-xl border border-white/[0.1] bg-[#07080c] px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400/35 focus:ring-2 focus:ring-cyan-400/25"
                    />
                  </div>

                  {TURNSTILE_SITE_KEY ? (
                    <div className="flex justify-center py-2">
                      <TurnstileWidget ref={turnstileRef} siteKey={TURNSTILE_SITE_KEY} />
                    </div>
                  ) : null}

                  <button
                    type="submit"
                    disabled={busy}
                    className="mt-2 flex min-h-[3rem] items-center justify-center rounded-xl bg-[linear-gradient(135deg,#67e8f9_0%,#38bdf8_50%,#6366f1_100%)] text-xs font-black uppercase tracking-[0.1em] text-[#050608] disabled:opacity-50"
                  >
                    {busy ? "Submitting…" : "Submit for approval"}
                  </button>
                </form>
              </div>
            )}

            <p className="mt-8 text-center text-xs text-white/40">
              <Link href="/admin/login" className="text-cyan-300/90 underline-offset-4 hover:underline">
                Already approved? Administrator Log In
              </Link>
              {" · "}
              <Link href="/" className="text-white/45 underline-offset-4 hover:underline">
                Home
              </Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
