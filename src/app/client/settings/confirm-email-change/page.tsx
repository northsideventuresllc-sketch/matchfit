"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

function MissingToken() {
  return (
    <main className="min-h-dvh bg-[#0B0C0F] px-5 py-12 text-white sm:px-8">
      <div className="mx-auto max-w-md space-y-6 text-center">
        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Confirm Email</h1>
        <p className="rounded-xl border border-[#E32B2B]/35 bg-[#E32B2B]/10 px-4 py-3 text-sm text-[#FFB4B4]" role="alert">
          Missing confirmation link. Open the link from your email.
        </p>
        <Link
          href="/client/settings"
          className="inline-block text-xs font-semibold uppercase tracking-wide text-white/45 hover:text-white/70"
        >
          ← Back to Account Settings
        </Link>
      </div>
    </main>
  );
}

function ConfirmWithToken(props: { token: string }) {
  const [status, setStatus] = useState<"loading" | "ok" | "err">("loading");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/client/settings/email-change/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: props.token }),
        });
        const data = (await res.json()) as { error?: string; email?: string };
        if (cancelled) return;
        if (!res.ok) {
          setStatus("err");
          setMessage(data.error ?? "Could not confirm email change.");
          return;
        }
        setStatus("ok");
        setMessage(data.email ? `Your sign-in email is now ${data.email}.` : "Your email has been updated.");
      } catch {
        if (!cancelled) {
          setStatus("err");
          setMessage("Something went wrong. Try again from Account Settings.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [props.token]);

  return (
    <main className="min-h-dvh bg-[#0B0C0F] px-5 py-12 text-white sm:px-8">
      <div className="mx-auto max-w-md space-y-6 text-center">
        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Confirm Email</h1>
        {status === "loading" ? <p className="text-sm text-white/55">Confirming your new address…</p> : null}
        {status === "ok" && message ? (
          <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100" role="status">
            {message}
          </p>
        ) : null}
        {status === "err" && message ? (
          <p className="rounded-xl border border-[#E32B2B]/35 bg-[#E32B2B]/10 px-4 py-3 text-sm text-[#FFB4B4]" role="alert">
            {message}
          </p>
        ) : null}
        <Link
          href="/client/settings"
          className="inline-block text-xs font-semibold uppercase tracking-wide text-white/45 hover:text-white/70"
        >
          ← Back to Account Settings
        </Link>
      </div>
    </main>
  );
}

function ConfirmBody() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  if (!token) {
    return <MissingToken />;
  }
  return <ConfirmWithToken token={token} />;
}

export default function ConfirmEmailChangePage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-dvh bg-[#0B0C0F] px-5 py-12 text-white sm:px-8">
          <div className="mx-auto max-w-md text-center text-sm text-white/55">Loading…</div>
        </main>
      }
    >
      <ConfirmBody />
    </Suspense>
  );
}
