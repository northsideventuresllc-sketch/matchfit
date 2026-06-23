"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { TrainerSignupShell, inputClass } from "@/components/trainer/trainer-signup-shell";
import { navigateWithFullLoad } from "@/lib/navigate-full-load";
import { FP_DOC_TYPE_LABELS } from "@/lib/fp-tier-docs";
import { FP_TIER_DISPLAY_NAMES, type FpDocType, isFpAccountTier } from "@/lib/fp-account-tier-types";

type DocState = {
  docType: FpDocType;
  label: string;
  fileUrl: string | null;
  status: string;
  autoSuggestedDecision: string | null;
  autoAnalysisSummary: string | null;
  rejectionReasonPolished: string | null;
  uploading: boolean;
};

function statusLabel(status: string, auto: string | null): string {
  if (status === "approved") return "Approved";
  if (status === "rejected") return "Needs re-upload";
  if (auto === "approve") return "Pending staff (auto: looks good)";
  if (auto === "deny") return "Pending staff (auto: issue flagged)";
  if (auto === "review") return "Pending staff review";
  return "Pending review";
}

export default function TrainerSignupDocsClient() {
  const router = useRouter();
  const [docs, setDocs] = useState<DocState[]>([]);
  const [tierLabel, setTierLabel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const loadDocs = useCallback(async () => {
    const res = await fetch("/api/trainer/signup/upload-doc", { credentials: "include" });
    if (!res.ok) {
      router.replace("/trainer/signup/tier");
      return false;
    }
    const data = (await res.json()) as {
      accountTier?: string;
      requiredDocs?: FpDocType[];
      documents?: Array<{
        docType: FpDocType;
        fileUrl: string;
        status: string;
        autoSuggestedDecision: string | null;
        autoAnalysisSummary: string | null;
        rejectionReasonPolished: string | null;
      }>;
    };
    if (!data.accountTier || !data.requiredDocs?.length) {
      navigateWithFullLoad("/trainer/signup/payment");
      return false;
    }
    setTierLabel(isFpAccountTier(data.accountTier) ? FP_TIER_DISPLAY_NAMES[data.accountTier] : data.accountTier);
    setDocs(
      data.requiredDocs.map((docType) => {
        const row = data.documents?.find((d) => d.docType === docType);
        return {
          docType,
          label: FP_DOC_TYPE_LABELS[docType],
          fileUrl: row?.fileUrl ?? null,
          status: row?.status ?? "missing",
          autoSuggestedDecision: row?.autoSuggestedDecision ?? null,
          autoAnalysisSummary: row?.autoAnalysisSummary ?? null,
          rejectionReasonPolished: row?.rejectionReasonPolished ?? null,
          uploading: false,
        };
      }),
    );
    return true;
  }, [router]);

  /* eslint-disable react-hooks/set-state-in-effect -- initial docs fetch */
  useEffect(() => {
    void loadDocs().finally(() => setLoading(false));
  }, [loadDocs]);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function uploadDoc(docType: FpDocType, file: File) {
    setError(null);
    setDocs((prev) => prev.map((d) => (d.docType === docType ? { ...d, uploading: true } : d)));
    try {
      const form = new FormData();
      form.set("docType", docType);
      form.set("file", file);
      const res = await fetch("/api/trainer/signup/upload-doc", {
        method: "POST",
        credentials: "include",
        body: form,
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        fileUrl?: string;
        analysis?: { decision: string; summary: string };
      };
      if (!res.ok) {
        setError(data.error ?? "Could not upload document.");
        return;
      }
      setDocs((prev) =>
        prev.map((d) =>
          d.docType === docType
            ? {
                ...d,
                fileUrl: data.fileUrl ?? d.fileUrl,
                status: "pending",
                autoSuggestedDecision: data.analysis?.decision ?? null,
                autoAnalysisSummary: data.analysis?.summary ?? null,
                rejectionReasonPolished: null,
                uploading: false,
              }
            : d,
        ),
      );
    } catch {
      setError("Could not upload document. Try again.");
    } finally {
      setDocs((prev) => prev.map((d) => (d.docType === docType ? { ...d, uploading: false } : d)));
    }
  }

  async function handleContinue() {
    const missing = docs.filter((d) => !d.fileUrl);
    if (missing.length > 0) {
      setError("Upload each required document before continuing.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      navigateWithFullLoad("/trainer/signup/payment");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <TrainerSignupShell stepLabel="Step 4" title="Required Documents" description="Loading…">
        <p className="text-white/55">Loading required documents…</p>
      </TrainerSignupShell>
    );
  }

  return (
    <TrainerSignupShell
      stepLabel="Step 4"
      title="Required Documents"
      description={
        tierLabel
          ? `Upload clear copies for review. You can build your profile while documents are pending. Account type: ${tierLabel}.`
          : "Upload clear copies for review. You can build your profile while documents are pending."
      }
      backHref="/trainer/signup/tier"
      backLabel="Back to Account Type"
    >
      <div className="space-y-5">
        {docs.map((doc) => (
          <div
            key={doc.docType}
            className="rounded-2xl border border-white/10 bg-[#12141C]/80 p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium text-white">{doc.label}</p>
                <p className="mt-1 text-xs text-white/45">PDF, JPG, PNG, or WebP · max 5 MB</p>
              </div>
              <span className="rounded-lg border border-white/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/55">
                {doc.uploading ? "Uploading…" : statusLabel(doc.status, doc.autoSuggestedDecision)}
              </span>
            </div>

            {doc.autoAnalysisSummary ? (
              <p className="mt-3 text-sm text-white/55">{doc.autoAnalysisSummary}</p>
            ) : null}
            {doc.rejectionReasonPolished ? (
              <p className="mt-2 text-sm text-amber-300/90">{doc.rejectionReasonPolished}</p>
            ) : null}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <input
                ref={(el) => {
                  fileRefs.current[doc.docType] = el;
                }}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadDoc(doc.docType, file);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                disabled={doc.uploading || busy}
                className="rounded-xl border border-[#FF7E00]/35 bg-[#FF7E00]/10 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-[#FFD34E] transition hover:bg-[#FF7E00]/20 disabled:opacity-50"
                onClick={() => fileRefs.current[doc.docType]?.click()}
              >
                {doc.fileUrl ? "Replace File" : "Choose File"}
              </button>
              {doc.fileUrl ? (
                <a
                  href={doc.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[#FF7E00] hover:underline"
                >
                  View upload
                </a>
              ) : null}
            </div>

            <div
              className={`${inputClass} mt-4 cursor-pointer border-dashed py-8 text-center text-sm text-white/40`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files?.[0];
                if (file) void uploadDoc(doc.docType, file);
              }}
              onClick={() => fileRefs.current[doc.docType]?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") fileRefs.current[doc.docType]?.click();
              }}
              role="button"
              tabIndex={0}
            >
              Drag and drop a file here, or click to browse
            </div>
          </div>
        ))}
      </div>

      {error ? <p className="mt-6 text-sm text-red-400">{error}</p> : null}

      <button
        type="button"
        disabled={busy}
        className="mt-8 w-full rounded-xl bg-[#FF7E00] px-4 py-3.5 text-sm font-bold uppercase tracking-wide text-black transition hover:bg-[#ff9633] disabled:opacity-50"
        onClick={() => void handleContinue()}
      >
        {busy ? "Continuing…" : "Continue"}
      </button>
    </TrainerSignupShell>
  );
}
