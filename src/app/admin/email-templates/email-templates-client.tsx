"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AdminPortalShell } from "@/components/admin/admin-portal-shell";
import {
  adminPortalCardClass,
  adminPortalPrimaryButtonClass,
  adminPortalSecondaryButtonClass,
  adminPortalSectionEyebrowClass,
} from "@/components/admin/admin-portal-styles";
import type { TransactionalEmailKind } from "@/lib/transactional-email-kinds";
import type { TransactionalEmailTemplateFields } from "@/lib/transactional-email-template-types";

type TemplateRow = {
  kind: TransactionalEmailKind;
  label: string;
  placeholders: string[];
  fields: TransactionalEmailTemplateFields;
  hasOverride: boolean;
  hasPendingChange: boolean;
};

const DECISION_BANNERS: Record<string, string> = {
  approved: "The email template change was approved and is now live.",
  denied: "The change was denied and feedback was sent to the requesting administrator.",
  invalid: "That approval link is invalid or expired.",
  missing: "No pending template change was found.",
  already: "This request was already handled.",
  error: "Something went wrong processing the decision.",
};

export function EmailTemplatesClient() {
  const searchParams = useSearchParams();
  const decision = searchParams.get("decision");
  const decisionKind = searchParams.get("kind");

  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [canDirectEdit, setCanDirectEdit] = useState(false);
  const [adminCode, setAdminCode] = useState("");
  const [selectedKind, setSelectedKind] = useState<TransactionalEmailKind | null>(null);
  const [draft, setDraft] = useState<TransactionalEmailTemplateFields | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [previewSubject, setPreviewSubject] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const decisionNotice = useMemo(() => {
    if (!decision || !DECISION_BANNERS[decision]) return null;
    return decision === "approved" && decisionKind
      ? `${DECISION_BANNERS[decision]} (${decisionKind})`
      : DECISION_BANNERS[decision];
  }, [decision, decisionKind]);

  const bannerMessage = notice ?? decisionNotice;

  const selected = useMemo(
    () => templates.find((t) => t.kind === selectedKind) ?? null,
    [templates, selectedKind],
  );

  const loadTemplates = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/admin/email-templates");
      const data = (await res.json()) as {
        error?: string;
        templates?: TemplateRow[];
        canDirectEdit?: boolean;
        adminCode?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Could not load templates.");
      const rows = data.templates ?? [];
      setTemplates(rows);
      setCanDirectEdit(Boolean(data.canDirectEdit));
      setAdminCode(data.adminCode ?? "");
      setSelectedKind((prev) => {
        const next = prev ?? rows[0]?.kind ?? null;
        if (!prev && rows[0]) {
          setDraft(structuredClone(rows[0].fields));
        }
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load templates.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      setError(null);
      try {
        const res = await fetch("/api/admin/email-templates");
        const data = (await res.json()) as {
          error?: string;
          templates?: TemplateRow[];
          canDirectEdit?: boolean;
          adminCode?: string;
        };
        if (!active) return;
        if (!res.ok) throw new Error(data.error ?? "Could not load templates.");
        const rows = data.templates ?? [];
        setTemplates(rows);
        setCanDirectEdit(Boolean(data.canDirectEdit));
        setAdminCode(data.adminCode ?? "");
        const first = rows[0];
        if (first) {
          setSelectedKind((prev) => prev ?? first.kind);
          setDraft((prev) => prev ?? structuredClone(first.fields));
        }
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Could not load templates.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  function pickTemplate(kind: TransactionalEmailKind) {
    const row = templates.find((t) => t.kind === kind);
    if (!row) return;
    setSelectedKind(kind);
    setDraft(structuredClone(row.fields));
    setShowPreview(false);
    setNotice(null);
  }

  async function refreshPreview(fields: TransactionalEmailTemplateFields) {
    if (!selectedKind) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/email-templates/${selectedKind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields }),
      });
      const data = (await res.json()) as { preview?: { html: string; subject: string }; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Preview failed.");
      setPreviewHtml(data.preview?.html ?? "");
      setPreviewSubject(data.preview?.subject ?? "");
      setShowPreview(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preview failed.");
    } finally {
      setBusy(false);
    }
  }

  async function saveTemplate(confirmed = false) {
    if (!selectedKind || !draft) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/email-templates/${selectedKind}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: draft, confirmed }),
      });
      const data = (await res.json()) as {
        error?: string;
        message?: string;
        confirmation_required?: boolean;
        applied?: boolean;
        pendingApproval?: boolean;
      };

      if (res.status === 409 && data.error === "confirmation_required") {
        setConfirmOpen(true);
        return;
      }

      if (!res.ok) throw new Error(data.error ?? data.message ?? "Save failed.");

      setConfirmOpen(false);
      setNotice(
        data.pendingApproval
          ? data.message ?? "Sent for approval."
          : "Template saved. Future automated emails will use this version.",
      );
      await loadTemplates();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  function updateDraft(patch: Partial<TransactionalEmailTemplateFields>) {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  function updateBodyParagraph(index: number, value: string) {
    setDraft((prev) => {
      if (!prev) return prev;
      const bodyParagraphs = [...prev.bodyParagraphs];
      bodyParagraphs[index] = value;
      return { ...prev, bodyParagraphs };
    });
  }

  function addBodyParagraph() {
    setDraft((prev) => (prev ? { ...prev, bodyParagraphs: [...prev.bodyParagraphs, ""] } : prev));
  }

  function removeBodyParagraph(index: number) {
    setDraft((prev) => {
      if (!prev || prev.bodyParagraphs.length <= 1) return prev;
      return { ...prev, bodyParagraphs: prev.bodyParagraphs.filter((_, i) => i !== index) };
    });
  }

  return (
    <AdminPortalShell
      current="email-templates"
      maxWidth="full"
      title="Email Templates"
      description={
        canDirectEdit
          ? `Signed in as ${adminCode}. Your edits apply immediately to all future automated emails after confirmation.`
          : "Edits you save are sent to jb@match-fit.net for approval before they go live."
      }
    >
      {bannerMessage ? (
        <div className="mb-6 rounded-xl border border-[#FF7E00]/30 bg-[#FF7E00]/10 px-4 py-3 text-sm text-[#FFD34E]">
          {bannerMessage}
        </div>
      ) : null}
      {error ? (
        <div className="mb-6 rounded-xl border border-[#E32B2B]/35 bg-[#E32B2B]/10 px-4 py-3 text-sm text-[#FFB4B4]">
          {error}
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-white/50">Loading templates…</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(220px,280px)_minmax(0,1fr)]">
          <aside className={`${adminPortalCardClass} p-4`}>
            <p className={adminPortalSectionEyebrowClass}>Templates</p>
            <ul className="mt-3 max-h-[70vh] space-y-1 overflow-y-auto">
              {templates.map((t) => {
                const active = t.kind === selectedKind;
                return (
                  <li key={t.kind}>
                    <button
                      type="button"
                      onClick={() => pickTemplate(t.kind)}
                      className={`w-full rounded-lg px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.06em] transition ${
                        active
                          ? "bg-[#FF7E00]/15 text-[#FFD34E]"
                          : "text-white/55 hover:bg-white/[0.05] hover:text-white/85"
                      }`}
                    >
                      {t.label}
                      {t.hasOverride ? (
                        <span className="ml-1 text-[9px] text-[#86efac]">· live edit</span>
                      ) : null}
                      {t.hasPendingChange ? (
                        <span className="ml-1 text-[9px] text-[#FFD34E]">· pending</span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>

          <div className="space-y-4">
            {selected && draft ? (
              <>
                <div className={`${adminPortalCardClass} p-5`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className={adminPortalSectionEyebrowClass}>{selected.kind}</p>
                      <h2 className="mt-1 text-lg font-black text-white">{selected.label}</h2>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void refreshPreview(draft)}
                        className={adminPortalSecondaryButtonClass}
                      >
                        Preview Layout
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void saveTemplate(false)}
                        className={adminPortalPrimaryButtonClass}
                      >
                        Save Template
                      </button>
                    </div>
                  </div>

                  <p className="mt-4 text-xs text-white/45">
                    Use {"{{variable}}"} placeholders: {selected.placeholders.map((p) => `{{${p}}}`).join(", ")}
                  </p>

                  <div className="mt-5 grid gap-4">
                    <label className="block space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/40">Subject</span>
                      <input
                        value={draft.subject}
                        onChange={(e) => updateDraft({ subject: e.target.value })}
                        className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/40">Preheader</span>
                      <input
                        value={draft.preheader}
                        onChange={(e) => updateDraft({ preheader: e.target.value })}
                        className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/40">Hero title</span>
                      <input
                        value={draft.title}
                        onChange={(e) => updateDraft({ title: e.target.value })}
                        className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                      />
                    </label>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/40">
                          Body paragraphs (HTML allowed)
                        </span>
                        <button type="button" onClick={addBodyParagraph} className="text-[10px] font-bold uppercase text-[#FF7E00]">
                          Add paragraph
                        </button>
                      </div>
                      {draft.bodyParagraphs.map((para, i) => (
                        <div key={i} className="flex gap-2">
                          <textarea
                            value={para}
                            onChange={(e) => updateBodyParagraph(i, e.target.value)}
                            rows={3}
                            className="min-h-[72px] flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                          />
                          {draft.bodyParagraphs.length > 1 ? (
                            <button
                              type="button"
                              onClick={() => removeBodyParagraph(i)}
                              className={adminPortalSecondaryButtonClass}
                            >
                              Remove
                            </button>
                          ) : null}
                        </div>
                      ))}
                    </div>

                    <label className="block space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/40">Plain-text body</span>
                      <textarea
                        value={draft.textBody}
                        onChange={(e) => updateDraft({ textBody: e.target.value })}
                        rows={6}
                        className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 font-mono text-xs text-white"
                      />
                    </label>

                    {draft.ctaLabel != null ? (
                      <label className="block space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/40">Button label</span>
                        <input
                          value={draft.ctaLabel ?? ""}
                          onChange={(e) => updateDraft({ ctaLabel: e.target.value })}
                          className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                        />
                      </label>
                    ) : null}
                  </div>
                </div>

                {showPreview ? (
                  <div className={`${adminPortalCardClass} overflow-hidden`}>
                    <div className="border-b border-white/[0.08] px-5 py-3">
                      <p className={adminPortalSectionEyebrowClass}>Layout preview</p>
                      <p className="mt-1 text-sm text-white/70">Subject: {previewSubject}</p>
                    </div>
                    <iframe
                      title="Email layout preview"
                      srcDoc={previewHtml}
                      className="h-[640px] w-full border-0 bg-white"
                      sandbox=""
                    />
                  </div>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-white/50">Select a template to edit.</p>
            )}
          </div>
        </div>
      )}

      {confirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className={`${adminPortalCardClass} max-w-lg p-6`}>
            <h3 className="text-lg font-black text-white">Confirm email change</h3>
            <p className="mt-3 text-sm leading-relaxed text-white/65">
              You are changing the contents of this email, meaning all clients who receive will get this version of the
              email, not the prior one. Are you sure you want to go through with this?
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => setConfirmOpen(false)} className={adminPortalSecondaryButtonClass}>
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void saveTemplate(true)}
                className={adminPortalPrimaryButtonClass}
              >
                Yes, apply change
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AdminPortalShell>
  );
}
