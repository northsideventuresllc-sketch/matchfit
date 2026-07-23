"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { adminSecondaryButtonClass } from "@/components/admin/admin-portal-ui";

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
