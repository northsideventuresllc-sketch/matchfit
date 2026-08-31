"use client";

import { CopyButton } from "./ui-bits";

/**
 * Scrollable report shell, no AdminPortalShell/nav chrome — used both as the standalone
 * `/admin/content-calendar/v2/research/[id]` page ("open in its own tab") and, later, inline in a
 * modal from the Research panel. reportBody is plain text/markdown, rendered as-is (no markdown
 * parser dependency) so it reads correctly either way.
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
            {summary}
          </p>
        ) : null}

        <div className="mt-4 flex justify-end gap-2">
          <CopyButton value={reportBody} label="COPY REPORT" />
        </div>

        <article className="mt-3 max-h-[70vh] overflow-y-auto whitespace-pre-wrap rounded-2xl border border-white/[0.08] bg-[#12151C]/90 p-5 text-sm leading-relaxed text-white/80">
          {reportBody || "Nothing to show yet."}
        </article>
      </div>
    </div>
  );
}
