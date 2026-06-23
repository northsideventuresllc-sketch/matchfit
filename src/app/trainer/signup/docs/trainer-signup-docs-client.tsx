"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { navigateWithFullLoad } from "@/lib/navigate-full-load";
import { FP_DOC_TYPE_LABELS } from "@/lib/fp-tier-docs";
import type { FpDocType } from "@/lib/fp-account-tier-types";

const inputClass =
  "w-full rounded-xl border border-white/10 bg-[#0E1016] px-4 py-3 text-[15px] text-white outline-none ring-[#FF7E00]/40 transition placeholder:text-white/25 focus:border-[#FF7E00]/40 focus:ring-2";

type DocRow = {
  docType: FpDocType;
  label: string;
  fileUrl: string;
};

export default function TrainerSignupDocsClient() {
  const router = useRouter();
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [tier, setTier] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch("/api/trainer/dashboard/account-tier", { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) {
          router.replace("/trainer/signup/tier");
          return;
        }
        const data = (await res.json()) as {
          accountTier?: string;
          requiredDocs?: FpDocType[];
        };
        if (!data.accountTier || !data.requiredDocs?.length) {
          navigateWithFullLoad("/trainer/signup/payment");
          return;
        }
        setTier(data.accountTier);
        setDocs(
          data.requiredDocs.map((docType) => ({
            docType,
            label: FP_DOC_TYPE_LABELS[docType],
            fileUrl: "",
          })),
        );
      })
      .catch(() => router.replace("/trainer/signup/tier"))
      .finally(() => setLoading(false));
  }, [router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const missing = docs.filter((d) => !d.fileUrl.trim());
    if (missing.length > 0) {
      setError("Upload or paste a file URL for each required document.");
      return;
    }
    setBusy(true);
    try {
      for (const doc of docs) {
        const res = await fetch("/api/trainer/signup/submit-doc", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ docType: doc.docType, fileUrl: doc.fileUrl.trim() }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          setError(data.error ?? "Could not submit documents.");
          return;
        }
      }
      navigateWithFullLoad("/trainer/signup/payment");
    } catch {
      setError("Could not submit documents. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="px-4 py-10 text-white/70">Loading required documents…</p>;
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-10 text-white">
      <p className="text-xs font-medium uppercase tracking-widest text-[#FF7E00]">Step 4</p>
      <h1 className="mt-2 text-3xl font-semibold">Required Documents</h1>
      <p className="mt-2 text-white/70">
        Submit each document for review. You can build your profile while documents are pending.
        {tier ? ` Account type: ${tier.replace(/_/g, " ")}.` : ""}
      </p>

      <form onSubmit={(e) => void handleSubmit(e)} className="mt-8 space-y-6">
        {docs.map((doc, idx) => (
          <label key={doc.docType} className="block">
            <span className="text-sm font-medium text-white/90">{doc.label}</span>
            <input
              className={`${inputClass} mt-2`}
              placeholder="https://… or /uploads/…"
              value={doc.fileUrl}
              onChange={(e) => {
                const next = [...docs];
                next[idx] = { ...doc, fileUrl: e.target.value };
                setDocs(next);
              }}
            />
          </label>
        ))}

        {error ? <p className="text-sm text-red-400">{error}</p> : null}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-[#FF7E00] px-4 py-3 text-sm font-semibold uppercase text-black transition hover:bg-[#ff9633] disabled:opacity-50"
        >
          {busy ? "Submitting…" : "Submit Documents"}
        </button>
      </form>

      <p className="mt-8 text-sm text-white/50">
        <Link href="/trainer/signup/tier" className="text-[#FF7E00] hover:underline">
          Back to account type
        </Link>
      </p>
    </div>
  );
}
