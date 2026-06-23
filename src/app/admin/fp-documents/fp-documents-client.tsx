"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminPortalShell } from "@/components/admin/admin-portal-shell";
import {
  adminPortalCardClass,
  adminPortalInputClass,
  adminPortalPrimaryButtonClass,
  adminPortalSecondaryButtonClass,
} from "@/components/admin/admin-portal-styles";

type DocRow = {
  id: string;
  trainerId: string;
  trainerName: string;
  trainerEmail: string;
  trainerUsername: string;
  accountTier: string | null;
  docType: string;
  docLabel: string;
  fileUrl: string;
  status: string;
  submittedAt: string;
  autoSuggestedDecision: string | null;
  autoAnalysisSummary: string | null;
};

export function FpDocumentsClient() {
  const [documents, setDocuments] = useState<DocRow[]>([]);
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [denyReasons, setDenyReasons] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/fp-documents?filter=${filter}`, { credentials: "include" });
      if (!res.ok) {
        setError("Could not load documents.");
        return;
      }
      const data = (await res.json()) as { documents: DocRow[] };
      setDocuments(data.documents);
    } catch {
      setError("Could not load documents.");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  /* eslint-disable react-hooks/set-state-in-effect -- initial document queue */
  useEffect(() => {
    void load();
  }, [load]);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function review(docId: string, decision: "approve" | "deny") {
    setBusyId(docId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/fp-documents/${docId}/review`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision,
          denialReason: decision === "deny" ? denyReasons[docId]?.trim() : undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Review failed.");
        return;
      }
      await load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AdminPortalShell
      current="fp-documents"
      title="Fitness Pro Documents"
      description="Review uploaded onboarding documents. Automated readings suggest approve or deny; your decision sends the trainer email."
    >
      <div className="mb-6 flex flex-wrap gap-2">
        <button
          type="button"
          className={filter === "pending" ? adminPortalPrimaryButtonClass : adminPortalSecondaryButtonClass}
          onClick={() => setFilter("pending")}
        >
          Pending
        </button>
        <button
          type="button"
          className={filter === "all" ? adminPortalPrimaryButtonClass : adminPortalSecondaryButtonClass}
          onClick={() => setFilter("all")}
        >
          All
        </button>
      </div>

      {loading ? <p className="text-white/60">Loading…</p> : null}
      {error ? <p className="mb-4 text-sm text-red-400">{error}</p> : null}

      <div className="space-y-4">
        {documents.length === 0 && !loading ? (
          <p className="text-white/50">No documents in this queue.</p>
        ) : null}

        {documents.map((doc) => (
          <article key={doc.id} className={`${adminPortalCardClass} space-y-4`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-[#FF7E00]">{doc.docLabel}</p>
                <h2 className="mt-1 text-lg font-semibold text-white">{doc.trainerName}</h2>
                <p className="text-sm text-white/55">
                  @{doc.trainerUsername} · {doc.trainerEmail}
                </p>
                <p className="mt-1 text-xs text-white/40">
                  {doc.accountTier?.replace(/_/g, " ") ?? "—"} · {new Date(doc.submittedAt).toLocaleString()} ·{" "}
                  {doc.status}
                </p>
              </div>
              <a
                href={doc.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-[#FF7E00] hover:underline"
              >
                Open File
              </a>
            </div>

            {doc.autoAnalysisSummary ? (
              <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/70">
                <p className="text-xs font-semibold uppercase tracking-wider text-white/45">Automated reading</p>
                <p className="mt-1">
                  Suggestion: <span className="font-medium text-white">{doc.autoSuggestedDecision ?? "review"}</span>
                </p>
                <p className="mt-1">{doc.autoAnalysisSummary}</p>
              </div>
            ) : null}

            {doc.status === "pending" ? (
              <div className="space-y-3">
                <label className="block text-sm text-white/70">
                  Denial reason (required if you deny)
                  <textarea
                    className={`${adminPortalInputClass} mt-2 min-h-[80px]`}
                    value={denyReasons[doc.id] ?? ""}
                    onChange={(e) => setDenyReasons((prev) => ({ ...prev, [doc.id]: e.target.value }))}
                    placeholder="e.g. certification expired, logo is blurry"
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busyId === doc.id}
                    className={adminPortalPrimaryButtonClass}
                    onClick={() => void review(doc.id, "approve")}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={busyId === doc.id}
                    className={adminPortalSecondaryButtonClass}
                    onClick={() => void review(doc.id, "deny")}
                  >
                    Deny
                  </button>
                </div>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </AdminPortalShell>
  );
}
