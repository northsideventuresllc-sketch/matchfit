"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  adminCardClass,
  adminInputClassSm,
  adminLabelClass,
  adminPrimaryButtonClass,
  adminSecondaryButtonClass,
} from "@/components/admin/admin-portal-ui";
import {
  CONTENT_CALENDAR_GROUPS,
  CONTENT_CALENDAR_POST_TYPES,
  type ContentCalendarGroup,
  type ContentCalendarPostType,
} from "@/lib/content-calendar/constants";
import { Modal, ProgressBar } from "./ui-bits";

type Entry = {
  id: string;
  postType: ContentCalendarPostType;
  targetAudience: ContentCalendarGroup;
  operatorPrompt: string;
};

function blankEntry(): Entry {
  return {
    id: Math.random().toString(36).slice(2),
    postType: "Static",
    targetAudience: "Join the Team",
    operatorPrompt: "",
  };
}

/**
 * Impromptu generation, reworked to one post at a time with an "Add another" batch builder. Each
 * entry hits the single-post endpoint once (drafts land straight in the Content Hub), a phase-weighted
 * progress bar tracks the batch, and a confirmation modal fires once every entry has been added.
 */
export function ImpromptuPanel({
  disabled,
  onGenerated,
  setError,
}: {
  disabled: boolean;
  onGenerated: () => Promise<void>;
  setError: (error: string | null) => void;
}) {
  const [entries, setEntries] = useState<Entry[]>(() => [blankEntry()]);
  const [generating, setGenerating] = useState(false);
  const [percent, setPercent] = useState(0);
  const [showDone, setShowDone] = useState(false);
  const intervalRef = useRef<number | null>(null);

  const clearCreep = useCallback(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => () => clearCreep(), [clearCreep]);

  function updateEntry(id: string, patch: Partial<Entry>) {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }

  function removeEntry(id: string) {
    setEntries((prev) => (prev.length === 1 ? prev : prev.filter((e) => e.id !== id)));
  }

  const startCreep = useCallback(
    (total: number, done: number) => {
      clearCreep();
      const ceiling = Math.min(99, ((done + 1) / total) * 100 - 1);
      intervalRef.current = window.setInterval(() => {
        setPercent((p) => {
          if (p >= ceiling) return ceiling;
          return Math.min(ceiling, p + Math.max(0.5, (ceiling - p) * 0.08));
        });
      }, 180);
    },
    [clearCreep],
  );

  async function generate() {
    setGenerating(true);
    setError(null);
    setPercent(2);
    const total = entries.length;
    let success = 0;

    try {
      for (let i = 0; i < total; i += 1) {
        const entry = entries[i];
        setPercent(Math.round((i / total) * 100));
        startCreep(total, i);
        const res = await fetch("/api/admin/content-calendar/v2/impromptu/single", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            postType: entry.postType,
            targetAudience: entry.targetAudience,
            operatorPrompt: entry.operatorPrompt.trim() || undefined,
          }),
        });
        clearCreep();
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) throw new Error(data.error ?? "Impromptu generation failed.");
        success += 1;
        setPercent(Math.round((success / total) * 100));
      }
      setPercent(100);
      await onGenerated();
      setShowDone(true);
      setEntries([blankEntry()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impromptu generation failed.");
    } finally {
      clearCreep();
      setGenerating(false);
    }
  }

  return (
    <section className={adminCardClass}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-black uppercase tracking-[0.12em] text-white">Impromptu Content Generation</h2>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-white/55">
            Build one post at a time. Add as many entries as you need, then Generate — each becomes a draft in the
            Content Hub.
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        {entries.map((entry, index) => (
          <div key={entry.id} className="rounded-2xl border border-white/[0.06] bg-[#0E1016]/80 p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-[#FFD34E]">Post {index + 1}</p>
              {entries.length > 1 ? (
                <button
                  type="button"
                  className="text-[11px] font-bold uppercase tracking-wide text-white/40 transition hover:text-[#FFB4B4]"
                  onClick={() => removeEntry(entry.id)}
                >
                  Remove
                </button>
              ) : null}
            </div>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <label>
                <span className={adminLabelClass}>Post type</span>
                <select
                  className={`${adminInputClassSm} mt-1`}
                  value={entry.postType}
                  onChange={(e) => updateEntry(entry.id, { postType: e.target.value as ContentCalendarPostType })}
                >
                  {CONTENT_CALENDAR_POST_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className={adminLabelClass}>Target audience</span>
                <select
                  className={`${adminInputClassSm} mt-1`}
                  value={entry.targetAudience}
                  onChange={(e) => updateEntry(entry.id, { targetAudience: e.target.value as ContentCalendarGroup })}
                >
                  {CONTENT_CALENDAR_GROUPS.map((group) => (
                    <option key={group} value={group}>
                      {group}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="mt-3 block">
              <span className={adminLabelClass}>Operator prompt (optional)</span>
              <textarea
                className={`${adminInputClassSm} mt-1 min-h-[90px]`}
                value={entry.operatorPrompt}
                placeholder="What should this post say or react to? Leave blank to use the live scans and NI Brain."
                onChange={(e) => updateEntry(entry.id, { operatorPrompt: e.target.value })}
              />
            </label>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className={adminSecondaryButtonClass}
          disabled={generating}
          onClick={() => setEntries((prev) => [...prev, blankEntry()])}
        >
          ADD ANOTHER
        </button>
        <button
          type="button"
          className={adminPrimaryButtonClass}
          disabled={disabled || generating}
          onClick={() => void generate()}
        >
          {generating ? "GENERATING…" : "GENERATE"}
        </button>
      </div>

      {generating ? (
        <div className="mt-4">
          <ProgressBar percent={percent} label={`Generating ${entries.length} draft${entries.length === 1 ? "" : "s"}`} />
        </div>
      ) : null}

      {showDone ? (
        <Modal title="Impromptu generation" onClose={() => setShowDone(false)}>
          <p className="text-sm leading-relaxed text-white/80">ALL DRAFTS HAVE BEEN ADDED TO CONTENT HUB.</p>
          <div className="mt-5 flex justify-end">
            <button type="button" className={adminPrimaryButtonClass} onClick={() => setShowDone(false)}>
              OKAY
            </button>
          </div>
        </Modal>
      ) : null}
    </section>
  );
}
