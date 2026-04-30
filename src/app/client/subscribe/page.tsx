"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { navigateWithFullLoad } from "@/lib/navigate-full-load";

function SubscribeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const canceled = searchParams.get("canceled") === "1";

  const [loading, setLoading] = useState(true);
  const [fatal, setFatal] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/client/billing/create-subscription", { method: "POST" });
        const data = (await res.json()) as { error?: string; url?: string };
        if (cancelled) return;
        if (!res.ok) {
          setFatal(data.error ?? "Unable to start checkout.");
          setLoading(false);
          return;
        }
        if (!data.url) {
          setFatal("Checkout could not be initialized.");
          setLoading(false);
          return;
        }
        navigateWithFullLoad(data.url);
      } catch {
        if (!cancelled) {
          setFatal("Network error. Try again.");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function abandon() {
    await fetch("/api/client/registration-hold/abandon", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <main className="relative min-h-dvh overflow-x-hidden bg-[#0B0C0F] text-white antialiased">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(255,211,78,0.12),transparent_55%),radial-gradient(ellipse_90%_60%_at_100%_0%,rgba(255,126,0,0.08),transparent_50%)]"
      />
      <div className="relative z-10 mx-auto max-w-lg px-5 py-12 sm:px-8">
        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Subscription</h1>
        <p className="mt-4 text-sm leading-relaxed text-white/65 sm:text-base">
          Match Fit is <span className="font-semibold text-white">$5.00 per month</span>. The calendar day you complete
          your first successful payment becomes your monthly billing date. If you first subscribe on the 31st of a
          month, your next automatic charge is scheduled for the{" "}
          <span className="font-semibold text-white">1st</span> of the following month (and continues from there).
        </p>
        <p className="mt-4 text-sm leading-relaxed text-white/55">
          Card numbers are collected by <span className="font-semibold text-white">Stripe</span>, a PCI-compliant
          payments processor. Match Fit does not store your full card details on our servers—only Stripe&apos;s secure
          tokens and subscription references. Your payment information is not sold or shared with unrelated third
          parties; it is used solely to run your subscription through Stripe.
        </p>
        <p className="mt-3 text-xs leading-relaxed text-white/40">
          Your profile is only created in our database after your first payment succeeds. If you leave without paying,
          use &quot;Cancel and delete my sign-up&quot; so your in-progress registration is permanently removed.
        </p>

        {canceled ? (
          <p className="mt-8 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white/70" role="status">
            Checkout was canceled. You can try again below, or leave and delete your sign-up.
          </p>
        ) : null}

        {loading ? (
          <p className="mt-10 text-sm text-white/50">Redirecting to secure checkout…</p>
        ) : fatal ? (
          <div className="mt-10 space-y-4">
            <p className="rounded-xl border border-[#E32B2B]/35 bg-[#E32B2B]/10 px-4 py-3 text-sm text-[#FFB4B4]" role="alert">
              {fatal}
            </p>
            <button
              type="button"
              onClick={abandon}
              className="text-sm font-semibold text-[#FF7E00] underline-offset-2 hover:underline"
            >
              Cancel and delete my sign-up
            </button>
            <p>
              <Link href="/" className="text-xs text-white/45 hover:text-white/65">
                Home
              </Link>
            </p>
          </div>
        ) : (
          <p className="mt-10 text-sm text-white/50">If you were not redirected, refresh this page.</p>
        )}

        {!loading && !fatal ? (
          <button
            type="button"
            onClick={abandon}
            className="mt-8 w-full text-center text-xs font-semibold uppercase tracking-wide text-white/40 transition hover:text-white/65"
          >
            Cancel and delete my sign-up
          </button>
        ) : null}

        <p className="mt-10 text-xs text-white/35">
          <Link href="/terms" className="underline-offset-2 hover:text-white/55 hover:underline">
            Terms of Service
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function SubscribePage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-dvh bg-[#0B0C0F] px-5 py-12 text-sm text-white/50 antialiased">Loading…</main>
      }
    >
      <SubscribeContent />
    </Suspense>
  );
}
