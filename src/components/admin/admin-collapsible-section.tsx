"use client";

import { useId, useState, type ReactNode } from "react";

type Props = {
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  /** Open by default. Defaults to true so nothing hides on first load. */
  defaultOpen?: boolean;
  className?: string;
};

/**
 * Collapsible wrapper for an Ad Tracking HQ section. Plain <details>/<summary> would be simpler,
 * but Safari and some screen readers handle a real button + aria-expanded more predictably for a
 * section this dense, so this uses that pattern instead.
 */
export function AdminCollapsibleSection({ title, subtitle, children, defaultOpen = true, className = "" }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={contentId}
        className="flex w-full items-start justify-between gap-3 text-left"
      >
        <div className="min-w-0">{title}</div>
        <span
          aria-hidden
          className={`mt-1 shrink-0 text-white/40 transition-transform ${open ? "rotate-180" : ""}`}
        >
          ▾
        </span>
      </button>
      {subtitle ? <div className="mt-1">{subtitle}</div> : null}
      <div id={contentId} hidden={!open} className="mt-4">
        {children}
      </div>
    </div>
  );
}

/**
 * Small inline disclosure for a technical/dev-facing detail block inside an otherwise
 * plain-English section (env var names, API terminology). Collapsed by default on purpose —
 * this is the "clean up ... plain English" pairing with "collapsable" from MF-AD-TRACKING-UX.
 */
export function AdminTechnicalDetails({ children, label = "Technical details" }: { children: ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  const contentId = useId();

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={contentId}
        className="text-[10px] font-black uppercase tracking-wide text-white/35 hover:text-white/55"
      >
        {open ? "▾ " : "▸ "}
        {label}
      </button>
      <div id={contentId} hidden={!open} className="mt-2 rounded-lg border border-white/[0.06] bg-black/20 p-3 text-[11px] leading-relaxed text-white/45">
        {children}
      </div>
    </div>
  );
}
