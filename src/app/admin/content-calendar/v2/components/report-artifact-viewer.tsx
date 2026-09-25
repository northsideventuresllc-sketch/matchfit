"use client";

import { useState, type ReactNode } from "react";
import { CopyButton } from "./ui-bits";

/** Renders "**bold**" spans inline; everything else passes through as plain text. */
function renderInlineBold(text: string, keyPrefix: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter((p) => p !== "");
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={`${keyPrefix}-${i}`} className="font-extrabold text-[#FFD34E]">
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
    const bulletMatch = line.match(/^[-•*]\s+(.*)$/);
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

export type ReportSection = {
  id: string;
  heading: string | null;
  level: 2 | 3;
  items: string[];
  paragraphs: string[];
  isCutSection: boolean;
};

/**
 * Checks if a section title indicates items to cut, drop, or stop doing.
 */
function isCutSectionHeading(heading: string): boolean {
  const lower = heading.toLowerCase();
  return (
    heading.includes("✂️") ||
    heading.includes("🛑") ||
    heading.includes("❌") ||
    lower.includes("cut") ||
    lower.includes("drop") ||
    lower.includes("stop") ||
    lower.includes("remove") ||
    lower.includes("take out")
  );
}

/**
 * Parses markdown into structured sections designed for ADHD/dyslexic visual chunking.
 */
export function parseReportSections(reportBody: string): ReportSection[] {
  const sections: ReportSection[] = [];
  let currentSection: ReportSection = {
    id: "sec-0",
    heading: null,
    level: 2,
    items: [],
    paragraphs: [],
    isCutSection: false,
  };

  const flushCurrent = () => {
    if (currentSection.heading || currentSection.items.length || currentSection.paragraphs.length) {
      sections.push(currentSection);
    }
  };

  let secCount = 0;
  for (const rawLine of reportBody.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;

    const headingMatch = line.match(/^(#{2,3})\s+(.*)$/);
    if (headingMatch) {
      flushCurrent();
      secCount++;
      const headingText = headingMatch[2].trim();
      currentSection = {
        id: `sec-${secCount}`,
        heading: headingText,
        level: headingMatch[1].length === 2 ? 2 : 3,
        items: [],
        paragraphs: [],
        isCutSection: isCutSectionHeading(headingText),
      };
      continue;
    }

    const bulletMatch = line.match(/^[-•*]\s+(.*)$/);
    if (bulletMatch) {
      currentSection.items.push(bulletMatch[1].trim());
      continue;
    }

    currentSection.paragraphs.push(line);
  }
  flushCurrent();

  return sections;
}

function SectionCard({
  section,
  cutChecked,
  onToggleCut,
}: {
  section: ReportSection;
  cutChecked: Record<string, boolean>;
  onToggleCut: (key: string) => void;
}) {
  const isCut = section.isCutSection;

  return (
    <div
      className={`rounded-2xl border p-4 sm:p-5 transition-colors ${
        isCut
          ? "border-[#FF4D4D]/40 bg-[#FF4D4D]/[0.07]"
          : "border-white/[0.09] bg-[#12151C]/90 hover:border-white/20"
      }`}
    >
      {section.heading ? (
        <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] pb-3">
          <h3 className="text-sm sm:text-base font-black uppercase tracking-wide text-white flex items-center gap-2">
            {section.heading}
          </h3>
          {isCut ? (
            <span className="rounded-full bg-[#FF4D4D]/20 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#FF8585] border border-[#FF4D4D]/30">
              Cut / Remove
            </span>
          ) : null}
        </div>
      ) : null}

      {section.paragraphs.length ? (
        <div className="mt-3 space-y-2">
          {section.paragraphs.map((p, idx) => (
            <p key={idx} className="text-sm leading-relaxed text-white/80">
              {renderInlineBold(p, `${section.id}-p${idx}`)}
            </p>
          ))}
        </div>
      ) : null}

      {section.items.length ? (
        <ul className="mt-3 space-y-2.5">
          {section.items.map((item, idx) => {
            const itemKey = `${section.id}-item-${idx}`;
            const isChecked = !!cutChecked[itemKey];

            if (isCut) {
              return (
                <li key={itemKey}>
                  <button
                    type="button"
                    onClick={() => onToggleCut(itemKey)}
                    className={`group flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-all ${
                      isChecked
                        ? "border-[#FF4D4D]/20 bg-black/40 opacity-50"
                        : "border-[#FF4D4D]/30 bg-[#FF4D4D]/10 hover:border-[#FF4D4D]/60 hover:bg-[#FF4D4D]/15"
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                        isChecked
                          ? "border-[#FF4D4D] bg-[#FF4D4D] text-black font-bold text-xs"
                          : "border-[#FF4D4D]/60 bg-black/30 group-hover:border-[#FF4D4D]"
                      }`}
                    >
                      {isChecked ? "✓" : ""}
                    </span>
                    <span
                      className={`text-sm leading-relaxed tracking-wide ${
                        isChecked ? "line-through text-white/40" : "text-white/90"
                      }`}
                    >
                      {renderInlineBold(item, itemKey)}
                    </span>
                  </button>
                </li>
              );
            }

            return (
              <li
                key={itemKey}
                className="flex items-start gap-3 rounded-xl border border-white/[0.04] bg-white/[0.02] p-3 text-sm leading-relaxed tracking-wide text-white/90"
              >
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#FFD34E]" aria-hidden />
                <div className="flex-1">{renderInlineBold(item, itemKey)}</div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * Scrollable report shell designed for ADHD and dyslexia accessibility:
 * - Chunked visual cards instead of a wall of text
 * - High-contrast yellow highlights on bold subtitles
 * - Interactive strike-through checklist on "What To Cut Out" items
 * - Zero cognitive clutter
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
  const [cutChecked, setCutChecked] = useState<Record<string, boolean>>({});
  const sections = reportBody ? parseReportSections(reportBody) : [];

  const handleToggleCut = (key: string) => {
    setCutChecked((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="min-h-screen bg-[#0B0D12] px-4 py-8 text-white sm:px-8 font-sans">
      <div className="mx-auto max-w-3xl space-y-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#FFD34E]">{title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-white/50">
            <span>{dateLabel}</span>
            {model ? <span>· {model}</span> : null}
          </div>
        </div>

        {summary ? (
          <div className="rounded-2xl border border-[#FF7E00]/30 bg-[#FF7E00]/10 p-4 sm:p-5">
            <p className="text-xs font-black uppercase tracking-wider text-[#FFD34E]">⚡ Key Takeaway</p>
            <p className="mt-1 text-sm sm:text-base leading-relaxed text-white/90">
              {renderInlineBold(summary, "summary")}
            </p>
          </div>
        ) : null}

        <div className="flex justify-end gap-2">
          <CopyButton value={reportBody} label="COPY REPORT" />
        </div>

        <article className="space-y-4 max-h-[72vh] overflow-y-auto pr-1">
          {sections.length ? (
            sections.map((section) => (
              <SectionCard
                key={section.id}
                section={section}
                cutChecked={cutChecked}
                onToggleCut={handleToggleCut}
              />
            ))
          ) : (
            <p className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-center text-sm text-white/50">
              No research content available yet.
            </p>
          )}
        </article>
      </div>
    </div>
  );
}

