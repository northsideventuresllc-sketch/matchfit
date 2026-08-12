"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { AdminPrimaryButton, adminInputClass } from "@/components/admin/admin-portal-ui";
import { adminPortalBackgroundLayers, adminPortalMainClass } from "@/components/admin/admin-portal-styles";
import { describePasswordPolicyViolations } from "@/lib/validations/client-register";

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
      const res = await fetch("/api/admin/settings/password-change/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = (await res.json()) as { error?: string; next?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not reset password.");
        return;
      }
      router.push(data.next ?? "/admin/login?passwordReset=1");
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
        <label htmlFor="admin-rp-new" className="text-xs font-semibold uppercase tracking-wide text-white/50">
          New password
        </label>
        <input
          id="admin-rp-new"
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className={adminInputClass}
          required
        />
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="admin-rp-confirm" className="text-xs font-semibold uppercase tracking-wide text-white/50">
          Confirm new password
        </label>
        <input
          id="admin-rp-confirm"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className={adminInputClass}
          required
        />
      </div>
      <p className="text-xs text-white/40">Use at least 8 characters, one capital letter, one number, and one special character.</p>
      <AdminPrimaryButton type="submit" disabled={busy} className="mt-2">
        {busy ? "Saving…" : "Save new password"}
      </AdminPrimaryButton>
    </form>
  );
}

export default function AdminResetPasswordPage() {
  return (
    <main className={adminPortalMainClass}>
      <div aria-hidden className={adminPortalBackgroundLayers.warmGlow} />
      <div aria-hidden className={adminPortalBackgroundLayers.vignette} />
      <div className="relative z-10 mx-auto flex min-h-svh max-w-lg flex-col px-5 pb-16 pt-10 sm:px-8 sm:pb-20 sm:pt-14">
        <Link href="/admin/login" className="text-xs font-semibold uppercase tracking-wide text-white/45 hover:text-white/70">
          ← Back to Administrator Portal
        </Link>
        <h1 className="mt-6 text-2xl font-black tracking-tight text-white sm:text-3xl">Set a New Password</h1>
        <p className="mt-2 text-sm text-white/55">Choose a strong password you have not used here before.</p>
        <Suspense fallback={<p className="mt-8 text-sm text-white/45">Loading…</p>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </main>
  );
}
