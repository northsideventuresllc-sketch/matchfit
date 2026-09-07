"use client";

import type { ReactNode } from "react";
import { CopyButton } from "./ui-bits";

/** Renders "**bold**" spans inline; everything else passes through as plain text. */
function renderInlineBold(text: string, keyPrefix: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter((p) => p !== "");
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={`${keyPrefix}-${i}`} className="font-bold text-[#FFD34E]">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={`${keyPrefix}-${i}`}>{part}</span>;
  });
}

export type ReportBlock =
  | { type: "heading"; level: 2 | 3; text: string }
  | { type: "bullets"; items: string[] }
  | { type: "paragraph"; text: string };

/**
 * Groups plain lines of the AI research report's restricted markdown subset (## / ### headings,
 * "- " or "• " bullets, **bold** spans, blank-line breaks) into renderable blocks. Deliberately not
 * a general markdown parser — the report prompt (run-research-pass.ts) only ever emits this exact
 * shape, and JB (ADHD) needs short scannable bullets over prose, so a stray paragraph line is kept
 * as its own block rather than silently folded into the bullet above it.
 */
export function parseReportBlocks(reportBody: string): ReportBlock[] {
  const blocks: ReportBlock[] = [];
  let currentBullets: string[] | null = null;

  const flushBullets = () => {
    if (currentBullets && currentBullets.length) blocks.push({ type: "bullets", items: currentBullets });
    currentBullets = null;
  };

  for (const rawLine of reportBody.split("\n")) {
    const line = rawLine.trim();
    if (!line) {
      flushBullets();
      continue;
    }

    const headingMatch = line.match(/^(#{2,3})\s+(.*)$/);
    if (headingMatch) {
      flushBullets();
      blocks.push({ type: "heading", level: headingMatch[1].length === 2 ? 2 : 3, text: headingMatch[2].trim() });
      continue;
    }

    const bulletMatch = line.match(/^[-•]\s+(.*)$/);
    if (bulletMatch) {
      if (!currentBullets) currentBullets = [];
      currentBullets.push(bulletMatch[1].trim());
      continue;
    }

    flushBullets();
    blocks.push({ type: "paragraph", text: line });
  }
  flushBullets();

  return blocks;
}

function ReportBlockView({ block, blockKey }: { block: ReportBlock; blockKey: string }) {
  if (block.type === "heading") {
    return (
      <h3
        className={
          block.level === 2
            ? "mt-5 text-sm font-black uppercase tracking-[0.1em] text-white first:mt-0"
            : "mt-4 text-xs font-bold uppercase tracking-wide text-white/70 first:mt-0"
        }
      >
        {block.text}
      </h3>
    );
  }
  if (block.type === "bullets") {
    return (
      <ul className="mt-2 space-y-1.5">
        {block.items.map((item, i) => (
          <li key={`${blockKey}-${i}`} className="flex gap-2 text-sm leading-snug text-white/85">
            <span className="text-white/35" aria-hidden>
              •
            </span>
            <span>{renderInlineBold(item, `${blockKey}-${i}`)}</span>
          </li>
        ))}
      </ul>
    );
  }
  return <p className="mt-2 text-sm leading-snug text-white/85">{renderInlineBold(block.text, blockKey)}</p>;
}

/**
 * Scrollable report shell, no AdminPortalShell/nav chrome — used both as the standalone
 * `/admin/content-calendar/v2/research/[id]` page ("open in its own tab") and inline in a modal
 * from the Research panel. Renders the report's restricted markdown subset (## headings, bullets,
 * **bold**) into short, scannable blocks per the adhd-support formatting rules — never a raw
 * whitespace-pre-wrap text dump, which is unreadable as a dense paragraph block.
 */
export function ReportArtifactViewer({
  title,
  dateLabel,
  summary,
  reportBody,
  model,
}: {
  title: string;
  dateLabel: string;
  summary: string;
  reportBody: string;
  model: string | null;
}) {
  const blocks = reportBody ? parseReportBlocks(reportBody) : [];

  return (
    <div className="min-h-screen bg-[#0B0D12] px-4 py-8 text-white sm:px-8">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-[#FFD34E]">{title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-white/45">
          <span>{dateLabel}</span>
          {model ? <span>· {model}</span> : null}
        </div>

        {summary ? (
          <p className="mt-4 rounded-xl border border-white/[0.08] bg-[#12151C]/90 p-4 text-sm leading-relaxed text-white/80">
            {renderInlineBold(summary, "summary")}
          </p>
        ) : null}

        <div className="mt-4 flex justify-end gap-2">
          <CopyButton value={reportBody} label="COPY REPORT" />
        </div>

        <article className="mt-3 max-h-[70vh] overflow-y-auto rounded-2xl border border-white/[0.08] bg-[#12151C]/90 p-5">
          {blocks.length ? (
            blocks.map((block, i) => <ReportBlockView key={i} block={block} blockKey={`b${i}`} />)
          ) : (
            <p className="text-sm text-white/50">Nothing to show yet.</p>
          )}
        </article>
      </div>
    </div>
  );
}
