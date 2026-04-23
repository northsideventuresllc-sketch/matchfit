"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { describePasswordPolicyViolations } from "@/lib/validations/client-register";

const inputClass =
  "w-full rounded-xl border border-white/10 bg-[#0E1016] px-4 py-3 text-[15px] text-white outline-none ring-[#FF7E00]/40 transition placeholder:text-white/25 focus:border-[#FF7E00]/40 focus:ring-2";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!token) {
      setError("This reset link is missing a token. Open the link from your email.");
      return;
    }
    const pwMsg = describePasswordPolicyViolations(newPassword);
    if (pwMsg) {
      setError(pwMsg);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/trainer/settings/password-change/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "email", token, newPassword }),
      });
      const data = (await res.json()) as { error?: string; next?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not reset password.");
        return;
      }
      router.push(data.next ?? "/trainer/dashboard/login?passwordReset=1");
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <p className="mt-6 rounded-xl border border-[#E32B2B]/35 bg-[#E32B2B]/10 px-4 py-3 text-sm text-[#FFB4B4]" role="alert">
        This page needs a valid reset link from your email.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
      {error ? (
        <p className="rounded-xl border border-[#E32B2B]/35 bg-[#E32B2B]/10 px-4 py-3 text-sm text-[#FFB4B4]" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-col gap-2">
        <label htmlFor="tr-rp-new" className="text-xs font-semibold uppercase tracking-wide text-white/50">
          New password
        </label>
        <input
          id="tr-rp-new"
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className={inputClass}
          required
        />
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="tr-rp-confirm" className="text-xs font-semibold uppercase tracking-wide text-white/50">
          Confirm new password
        </label>
        <input
          id="tr-rp-confirm"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className={inputClass}
          required
        />
      </div>
      <p className="text-xs text-white/40">Use at least 8 characters, one capital letter, and one special character.</p>
      <button
        type="submit"
        disabled={busy}
        className="group relative isolate mt-2 flex min-h-[3rem] w-full items-center justify-center overflow-hidden rounded-xl px-4 text-sm font-black uppercase tracking-[0.08em] text-[#0B0C0F] shadow-[0_20px_50px_-18px_rgba(227,43,43,0.45)] transition disabled:opacity-50"
      >
        <span aria-hidden className="absolute inset-0 bg-[linear-gradient(135deg,#FFD34E_0%,#FF7E00_45%,#E32B2B_100%)]" />
        <span className="relative">{busy ? "Saving…" : "Save new password"}</span>
      </button>
    </form>
  );
}

export default function TrainerResetPasswordPage() {
  return (
    <main className="min-h-dvh bg-[#0B0C0F] px-5 py-12 text-white sm:px-8">
      <div className="mx-auto max-w-md">
        <Link
          href="/trainer/dashboard/login"
          className="text-xs font-semibold uppercase tracking-wide text-white/45 hover:text-white/70"
        >
          ← Trainer log in
        </Link>
        <h1 className="mt-6 text-2xl font-black tracking-tight sm:text-3xl">Set a new password</h1>
        <p className="mt-2 text-sm text-white/55">Choose a strong password you have not used here before.</p>
        <Suspense fallback={<p className="mt-8 text-sm text-white/45">Loading…</p>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </main>
  );
}
