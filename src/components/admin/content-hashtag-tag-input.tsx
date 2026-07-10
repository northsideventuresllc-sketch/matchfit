"use client";

import { useCallback, useRef, useState, type KeyboardEvent } from "react";
import { adminInputClassSm } from "@/components/admin/admin-portal-ui";
import { sanitizeHashtagDraftToken } from "@/lib/content-calendar/content-calendar-clipboard";
import { CONTENT_CALENDAR_MAX_HASHTAGS } from "@/lib/content-calendar/content-rules";

const chipClass =
  "inline-flex select-none items-center gap-1 rounded-full border border-[#FF7E00]/30 bg-[#FF7E00]/10 px-2.5 py-1 text-[11px] font-semibold text-[#FFD34E]";

type Props = {
  tags: string[];
  onChange: (tags: string[]) => void;
  readOnly?: boolean;
};

export function ContentHashtagTagInput({ tags, onChange, readOnly = false }: Props) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const addTag = useCallback(
    (raw: string) => {
      const tag = sanitizeHashtagDraftToken(raw);
      if (!tag) return;
      const key = tag.toLowerCase();
      if (tags.some((existing) => existing.toLowerCase() === key)) {
        setDraft("");
        return;
      }
      if (tags.length >= CONTENT_CALENDAR_MAX_HASHTAGS) return;
      onChange([...tags, tag]);
      setDraft("");
    },
    [onChange, tags],
  );

  const removeTag = useCallback(
    (index: number) => {
      onChange(tags.filter((_, i) => i !== index));
    },
    [onChange, tags],
  );

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(draft);
      return;
    }
    if (e.key === "Backspace" && !draft && tags.length > 0) {
      removeTag(tags.length - 1);
    }
  }

  if (readOnly) {
    return (
      <div className="mt-1 flex flex-wrap gap-1.5">
        {tags.length ? (
          tags.map((tag) => (
            <span key={tag} className={chipClass}>
              #{tag.replace(/^#/, "")}
            </span>
          ))
        ) : (
          <span className="text-xs text-white/35">—</span>
        )}
      </div>
    );
  }

  const atLimit = tags.length >= CONTENT_CALENDAR_MAX_HASHTAGS;

  return (
    <div className="mt-1">
      <div
        role="group"
        aria-label="Hashtags"
        className={`${adminInputClassSm} flex min-h-[44px] flex-wrap items-center gap-1.5 py-2`}
        onClick={() => inputRef.current?.focus()}
      >
        {tags.map((tag, index) => (
          <span key={`${tag}-${index}`} className={chipClass}>
            #{tag.replace(/^#/, "")}
            <button
              type="button"
              className="rounded-full px-0.5 text-[10px] leading-none text-white/50 transition hover:bg-white/10 hover:text-white"
              aria-label={`Remove hashtag ${tag}`}
              onClick={(e) => {
                e.stopPropagation();
                removeTag(index);
              }}
            >
              ×
            </button>
          </span>
        ))}
        {!atLimit ? (
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={tags.length ? "Add another…" : "Type a tag, press Enter"}
            className="min-w-[8rem] flex-1 border-0 bg-transparent px-1 py-0.5 text-xs text-white outline-none placeholder:text-white/30"
          />
        ) : null}
      </div>
      <p className="mt-1 text-[10px] text-white/35">
        Press Enter to add a tag (up to {CONTENT_CALENDAR_MAX_HASHTAGS}). Like YouTube tags — each tag becomes a chip.
      </p>
    </div>
  );
}
