"use client";

import { FormEvent, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  adminPortalBackgroundLayers,
  adminPortalMainClass,
  adminPortalPrimaryButtonClass,
  adminPortalSecondaryButtonClass,
} from "@/components/admin/admin-portal-styles";

export default function EmailTemplateDenyClient() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [reviewNotes, setReviewNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/email-template-change-deny", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, reviewNotes }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not submit denial.");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit.");
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <main className={adminPortalMainClass}>
        <div className="relative z-10 mx-auto max-w-lg px-5 py-16 text-white">
          <p className="text-sm text-[#FFB4B4]">Missing or invalid denial link.</p>
        </div>
      </main>
    );
  }

  return (
    <main className={adminPortalMainClass}>
      <div aria-hidden className={adminPortalBackgroundLayers.warmGlow} />
      <div className="relative z-10 mx-auto max-w-lg px-5 py-16 text-white">
        <h1 className="text-2xl font-black">Deny email template change</h1>
        {done ? (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-white/65">
              The change was denied and your feedback was emailed to the requesting administrator.
            </p>
            <Link href="/admin/email-templates" className={adminPortalSecondaryButtonClass}>
              Back to Email Templates
            </Link>
          </div>
        ) : (
          <form onSubmit={(e) => void handleSubmit(e)} className="mt-6 space-y-4">
            <p className="text-sm text-white/55">
              Tell the administrator what needs to be adjusted or how to change the template.
            </p>
            <textarea
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              rows={8}
              required
              minLength={4}
              placeholder="Example: Shorten the subject line and remove the second paragraph about billing."
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
            />
            {error ? <p className="text-sm text-[#FFB4B4]">{error}</p> : null}
            <div className="flex flex-wrap gap-2">
              <button type="submit" disabled={busy} className={adminPortalPrimaryButtonClass}>
                Send denial & feedback
              </button>
              <Link href="/admin/email-templates" className={adminPortalSecondaryButtonClass}>
                Cancel
              </Link>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
