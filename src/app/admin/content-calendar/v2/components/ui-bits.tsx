"use client";

import { useEffect, useState, type ReactNode } from "react";
import { adminSecondaryButtonClass } from "@/components/admin/admin-portal-ui";

/** Parses a fetch Response as JSON, throwing the server's `error` message (or `fallback`) on a non-2xx status. */
export async function readApi<T>(res: Response, fallback: string): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? fallback);
  return data;
}

/** Determinate progress bar with a live percentage — used for every loading/queuing state. */
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
  copiedLabel = "COPIED",
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

/** <details>-style expand/collapse for a generation prompt, with a copy button once opened. Renders nothing for an empty prompt. */
export function SeePromptCollapsible({
  prompt,
  label = "SEE PROMPT",
}: {
  prompt: string | null | undefined;
  label?: string;
}) {
  if (!prompt?.trim()) return null;
  return (
    <details className="group rounded-xl border border-white/[0.08] bg-white/[0.02]">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-white/55 hover:text-white/80">
        <span className="inline-block transition-transform group-open:rotate-90">▸</span>
        {label}
      </summary>
      <div className="space-y-2 border-t border-white/[0.06] px-3 py-2">
        <p className="whitespace-pre-wrap text-xs leading-relaxed text-white/65">{prompt}</p>
        <CopyButton value={prompt} label="COPY PROMPT" />
      </div>
    </details>
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
