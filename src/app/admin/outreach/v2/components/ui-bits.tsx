"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  adminAccentButtonClass,
  adminInputClassSm,
  adminLabelClass,
  adminSecondaryButtonClass,
} from "@/components/admin/admin-portal-ui";
import { searchAdminAccounts, type AdminAccountSearchResult } from "./client-api";

/**
 * Determinate progress bar with a live percentage. Duplicated (not cross-imported) from the
 * Content Calendar v2 primitive to keep this feature folder self-contained — it is small and has
 * no shared logic worth extracting.
 */
export function ProgressBar({ percent, label }: { percent: number; label?: string }) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div className="space-y-1.5" role="status" aria-live="polite">
      <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wide text-white/55">
        <span>{label ?? "Working…"}</span>
        <span className="tabular-nums text-[#FFD34E]">{clamped}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,#FFD34E,#FF7E00,#E32B2B)] transition-[width] duration-200 ease-out"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

export type SaveStatus = "idle" | "saving" | "saved" | "error";

/**
 * Debounced autosave (WF2 item 5 — every edit saves itself; no Save button anywhere). Watches a
 * serialisable snapshot; after `delay` ms of no changes it calls `save` with the latest value.
 * The initial mount (seeded values) never triggers a save. Undo inside a field is native
 * browser cmd/ctrl+Z — there is no app-level undo stack by design.
 */
export function useAutosave<T>(
  value: T,
  save: (v: T) => Promise<{ ok: boolean }>,
  opts?: { delay?: number },
): SaveStatus {
  const delay = opts?.delay ?? 600;
  const [status, setStatus] = useState<SaveStatus>("idle");
  const firstRun = useRef(true);
  const latest = useRef(value);
  const saveRef = useRef(save);
  const serialized = JSON.stringify(value);

  // Keep the mutable refs current without writing to them during render.
  useEffect(() => {
    latest.current = value;
    saveRef.current = save;
  });

  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    setStatus("saving");
    const timer = window.setTimeout(async () => {
      const res = await saveRef.current(latest.current);
      setStatus(res.ok ? "saved" : "error");
    }, delay);
    return () => window.clearTimeout(timer);
  }, [serialized, delay]);

  return status;
}

/** Small inline "Saving… / Saved ✓ / Save failed" text that replaces the old Save button. */
export function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === "idle") return null;
  const map: Record<Exclude<SaveStatus, "idle">, { text: string; cls: string }> = {
    saving: { text: "Saving…", cls: "text-white/45" },
    saved: { text: "Saved ✓", cls: "text-emerald-300" },
    error: { text: "Save failed — check connection", cls: "text-[#FFB4B4]" },
  };
  const s = map[status];
  return <span className={`text-[11px] font-semibold ${s.cls}`}>{s.text}</span>;
}

/**
 * Regenerate popup (WF2 item 3): an optional feedback box, then Confirm regenerates. Stays open so
 * JB can read the result, add more feedback, and regenerate again — the "loops to improve" flow.
 */
export function RegenerateModal({
  title,
  onClose,
  onRegenerate,
}: {
  title: string;
  onClose: () => void;
  onRegenerate: (feedback: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [ran, setRan] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    setNote(null);
    const res = await onRegenerate(feedback.trim());
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Could not regenerate.");
      return;
    }
    setRan(true);
    setNote("Updated. Add more feedback and regenerate again, or close.");
  }

  return (
    <Modal title={title} onClose={onClose}>
      <label className="block space-y-1">
        <span className={adminLabelClass}>Feedback (optional)</span>
        <textarea
          className={adminInputClassSm}
          rows={3}
          value={feedback}
          placeholder="Shorter opener, lead with the founding promo, warmer tone…"
          onChange={(e) => setFeedback(e.target.value)}
        />
      </label>
      {note ? <p className="mt-2 text-xs font-semibold text-emerald-300">{note}</p> : null}
      {error ? <p className="mt-2 text-xs font-semibold text-[#FFB4B4]">{error}</p> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className={adminAccentButtonClass} disabled={busy} onClick={() => void run()}>
          {busy ? "Regenerating…" : ran ? "Regenerate again" : "Regenerate"}
        </button>
        <button type="button" className={adminSecondaryButtonClass} disabled={busy} onClick={onClose}>
          {ran ? "Done" : "Cancel"}
        </button>
      </div>
    </Modal>
  );
}

/** Generic confirm dialog (WF2 item 4/6 — Archive confirmation). */
export function ConfirmModal({
  title,
  message,
  confirmLabel = "Confirm",
  busy = false,
  danger = false,
  onCancel,
  onConfirm,
}: {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  busy?: boolean;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const confirmCls = danger
    ? "rounded-lg border border-[#E32B2B]/50 bg-[#E32B2B]/15 px-3 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-[#FFB4B4] transition hover:bg-[#E32B2B]/25 disabled:opacity-40"
    : adminAccentButtonClass;
  return (
    <Modal title={title} onClose={onCancel}>
      <div className="text-sm text-white/70">{message}</div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className={confirmCls} disabled={busy} onClick={onConfirm}>
          {busy ? "Working…" : confirmLabel}
        </button>
        <button type="button" className={adminSecondaryButtonClass} disabled={busy} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </Modal>
  );
}

/** Copy-to-clipboard button that flips to a confirmation label briefly. */
export function CopyButton({
  value,
  label,
  copiedLabel = "Copied",
  className,
  disabled,
}: {
  value: string;
  label: string;
  copiedLabel?: string;
  className?: string;
  disabled?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      className={className ?? adminSecondaryButtonClass}
      disabled={disabled || !value}
      onClick={() => void copy()}
    >
      {copied ? copiedLabel : label}
    </button>
  );
}

/** Lightweight centered modal with an X in the corner and click-outside to dismiss. */
export function Modal({
  title,
  onClose,
  children,
  maxWidthClass = "max-w-lg",
}: {
  title?: string;
  onClose: () => void;
  children: ReactNode;
  maxWidthClass?: string;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className={`relative w-full ${maxWidthClass} rounded-2xl border border-white/[0.08] bg-[#12151C] p-5 shadow-[0_40px_120px_-40px_rgba(0,0,0,0.9)] sm:p-6`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Close"
          className="absolute right-3 top-3 rounded-lg px-2 py-1 text-lg leading-none text-white/50 transition hover:bg-white/10 hover:text-white"
          onClick={onClose}
        >
          ×
        </button>
        {title ? (
          <h3 className="pr-8 text-sm font-black uppercase tracking-[0.12em] text-[#FFD34E]">{title}</h3>
        ) : null}
        <div className={title ? "mt-4" : "mt-2"}>{children}</div>
      </div>
    </div>
  );
}

/**
 * Search-and-pick a real Match Fit account (client or trainer) — used by the Converted button and
 * the conversions panel's "Link account" action. Linking is always optional: "Skip — link later"
 * closes without picking, since a lead can convert before its real account is fully set up.
 */
export function AccountPickerModal({
  onClose,
  onPick,
  onSkip,
}: {
  onClose: () => void;
  onPick: (account: { type: "client" | "trainer"; id: string; label: string }) => void;
  onSkip: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AdminAccountSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  async function runSearch() {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setError(null);
    const res = await searchAdminAccounts(q);
    setSearching(false);
    setSearched(true);
    if (!res.ok) {
      setError(res.error);
      setResults([]);
      return;
    }
    setResults(res.data);
  }

  return (
    <Modal title="Link Match Fit account" onClose={onClose}>
      <div className="space-y-3">
        <p className="text-xs text-white/55">Search by username or email to link the real account this lead converted into.</p>
        <div className="flex gap-2">
          <input
            className={adminInputClassSm}
            value={query}
            placeholder="Username or email…"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void runSearch();
            }}
          />
          <button type="button" className={adminSecondaryButtonClass} disabled={searching || !query.trim()} onClick={() => void runSearch()}>
            {searching ? "Searching…" : "Search"}
          </button>
        </div>
        {error ? <p className="text-xs font-semibold text-[#FFB4B4]">{error}</p> : null}
        {searched && !searching && results.length === 0 && !error ? (
          <p className="text-xs text-white/45">No accounts found.</p>
        ) : null}
        {results.length > 0 ? (
          <div className="max-h-64 space-y-1.5 overflow-y-auto">
            {results.map((r) => (
              <button
                key={`${r.accountType}-${r.id}`}
                type="button"
                className="block w-full truncate rounded-lg border border-white/[0.06] bg-[#0E1016]/60 px-3 py-2 text-left text-xs text-white/75 transition hover:border-[#FF7E00]/30 hover:text-[#FFD34E]"
                onClick={() =>
                  onPick({
                    type: r.accountType,
                    id: r.id,
                    label: `${r.firstName} ${r.lastName} (${r.username})`,
                  })
                }
              >
                {r.firstName} {r.lastName} <span className="text-white/35">· {r.username} · {r.email}</span>
                <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-white/40">{r.accountType}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className={adminSecondaryButtonClass} onClick={onSkip}>
          Skip — link later
        </button>
      </div>
    </Modal>
  );
}

/**
 * Collapsible card used everywhere leads are listed. `focus` (a shared focus target from the
 * Outreach Hub view) forces the card open and scrolls it into view once when it becomes the focus.
 */
export function CollapsibleCard({
  header,
  badges,
  defaultOpen = false,
  focus = false,
  children,
}: {
  header: ReactNode;
  badges?: ReactNode;
  defaultOpen?: boolean;
  focus?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen || focus);
  const ref = useRef<HTMLElement>(null);
  const focusedRef = useRef(false);

  useLayoutEffect(() => {
    if (focus && !focusedRef.current) {
      focusedRef.current = true;
      setOpen(true);
      ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    if (!focus) focusedRef.current = false;
  }, [focus]);

  return (
    <article
      ref={ref}
      className={`rounded-2xl border bg-[#12151C]/90 transition ${
        focus ? "border-[#FF7E00]/45 shadow-[0_0_0_1px_rgba(255,126,0,0.25)]" : "border-white/[0.08]"
      }`}
    >
      <button
        type="button"
        className="flex w-full items-start justify-between gap-3 p-4 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <div className="min-w-0 flex-1">{header}</div>
        <div className="flex shrink-0 items-center gap-2">
          {badges}
          <span
            className={`text-white/40 transition-transform ${open ? "rotate-180" : ""}`}
            aria-hidden
          >
            ▾
          </span>
        </div>
      </button>
      {open ? <div className="border-t border-white/[0.06] p-4">{children}</div> : null}
    </article>
  );
}
