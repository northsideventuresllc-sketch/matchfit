"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MATCH_FIT_SUPPORT_MAILTO } from "@/lib/match-fit-support-contact";

type Props = {
  apiPath: string;
  loginHref: string;
  loginLabel: string;
};

function WasntMeInner({ apiPath, loginHref, loginLabel }: Props) {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"working" | "locked" | "error">("working");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void fetch(apiPath, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        if (cancelled) return;
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          setStatus("error");
          setError(data.error ?? "Could not lock this account. Contact support directly.");
          return;
        }
        setStatus("locked");
      })
      .catch(() => {
        if (!cancelled) {
          setStatus("error");
          setError("Something went wrong. Contact support directly.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [apiPath, token]);

  const effectiveStatus = !token ? "error" : status;
  const effectiveError = !token
    ? "This link is missing its token. Open it directly from the email."
    : error;

  return (
    <main className="min-h-dvh bg-[#0B0C0F] px-5 py-12 text-white sm:px-8">
      <div className="mx-auto max-w-md">
        {effectiveStatus === "working" ? <p className="mt-8 text-sm text-white/55">Locking your account…</p> : null}

        {effectiveStatus === "locked" ? (
          <div className="mt-8 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-5 py-5">
            <h1 className="text-xl font-black tracking-tight text-amber-50">Account locked</h1>
            <p className="mt-3 text-sm leading-relaxed text-amber-100/90">
              Your account is locked and can&apos;t be signed into right now. This is on purpose — it stops anyone,
              including whoever changed the password, from using it while we sort this out with you.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-amber-100/90">
              Contact support to get it unlocked and secured.
            </p>
            <a
              href={MATCH_FIT_SUPPORT_MAILTO.accountAccess}
              className="mt-5 inline-flex min-h-[2.75rem] items-center justify-center rounded-xl bg-[linear-gradient(135deg,#FFD34E_0%,#FF7E00_45%,#E32B2B_100%)] px-5 text-xs font-black uppercase tracking-[0.1em] text-[#0B0C0F]"
            >
              Contact Support
            </a>
          </div>
        ) : null}

        {effectiveStatus === "error" ? (
          <p className="mt-8 rounded-xl border border-[#E32B2B]/35 bg-[#E32B2B]/10 px-4 py-3 text-sm text-[#FFB4B4]" role="alert">
            {effectiveError}
          </p>
        ) : null}

        <Link href={loginHref} className="mt-8 inline-block text-xs font-semibold uppercase tracking-wide text-white/45 hover:text-white/70">
          ← Back to {loginLabel}
        </Link>
      </div>
    </main>
  );
}

export function AccountWasntMePage(props: Props) {
  return (
    <Suspense fallback={<main className="min-h-dvh bg-[#0B0C0F] px-5 py-12 text-white sm:px-8" />}>
      <WasntMeInner {...props} />
    </Suspense>
  );
}
