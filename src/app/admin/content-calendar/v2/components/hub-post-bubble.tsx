"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  adminLabelClass,
  adminInputClassSm,
  adminPrimaryButtonClass,
  adminSecondaryButtonClass,
} from "@/components/admin/admin-portal-ui";
import { ContentHashtagTagInput } from "@/components/admin/content-hashtag-tag-input";
import { buildCaptionWithHashtags } from "@/lib/content-calendar/content-calendar-clipboard";
import type { ClientContentCalendarV2Post } from "@/lib/content-calendar/content-calendar-v2-store";
import { CopyButton } from "./ui-bits";
import { postTypeIcon } from "./helpers";
import { ReferenceFilesField } from "./reference-files-field";

function arraysEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/**
 * One post inside a Content Hub day container. Text posts show the copy + hashtags; media posts
 * (Static / Carousel / Video) show the image/video summary + goal, the generation prompt (which the
 * backend already bakes dimensions + brand colors + logo reference into) with a copy-prompt button,
 * and everything carries a "how this fits the DPMO" rationale bound to `dpmoRationale`. Edits are
 * saved through the PATCH route and reported to the shared unsaved-changes registry.
 */
export function HubPostBubble({
  post,
  busy,
  onPatch,
  onDelete,
  onRegenerate,
  register,
  unregister,
  onSubmitForGeneration,
}: {
  post: ClientContentCalendarV2Post;
  busy: boolean;
  onPatch: (id: string, fields: Partial<ClientContentCalendarV2Post>) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onRegenerate?: (id: string) => Promise<void>;
  register: (key: string, dirty: boolean, save: () => Promise<void>) => void;
  unregister: (key: string) => void;
  /** Impromptu-lane only — fires `submit_for_generation` (Text→publishing, media→agent job→pending). */
  onSubmitForGeneration: (id: string) => Promise<void>;
}) {
  const isText = post.postType === "Text";
  const isImpromptu = post.contentLane === "impromptu";
  const [caption, setCaption] = useState(post.caption);
  const [hashtags, setHashtags] = useState<string[]>(post.hashtags);
  const [visualPrompt, setVisualPrompt] = useState(post.visualPrompt ?? "");
  const [dpmoRationale, setDpmoRationale] = useState(post.dpmoRationale ?? "");
  const [editDpmo, setEditDpmo] = useState(false);
  const [postDate, setPostDate] = useState(post.postDate ?? "");
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const prevPostIdRef = useRef(post.id);

  // Sync state only if post.id changed, preventing outside updates from overwriting in-flight typing
  useEffect(() => {
    if (prevPostIdRef.current !== post.id) {
      prevPostIdRef.current = post.id;
      setCaption(post.caption);
      setHashtags(post.hashtags);
      setVisualPrompt(post.visualPrompt ?? "");
      setDpmoRationale(post.dpmoRationale ?? "");
      setPostDate(post.postDate ?? "");
    }
  }, [post.id, post.caption, post.hashtags, post.visualPrompt, post.dpmoRationale, post.postDate]);

  const dirty =
    caption !== post.caption ||
    !arraysEqual(hashtags, post.hashtags) ||
    (!isText && visualPrompt !== (post.visualPrompt ?? "")) ||
    dpmoRationale !== (post.dpmoRationale ?? "") ||
    postDate !== (post.postDate ?? "");

  const save = useCallback(async () => {
    setSaving(true);
    try {
      await onPatch(post.id, {
        caption,
        hashtags,
        visualPrompt: isText ? null : visualPrompt,
        dpmoRationale: dpmoRationale.trim() ? dpmoRationale : null,
        postDate,
      });
    } finally {
      setSaving(false);
    }
  }, [caption, dpmoRationale, hashtags, isText, onPatch, post.id, postDate, visualPrompt]);

  // Debounced auto-save on every edit (1000ms delay)
  useEffect(() => {
    if (!dirty || busy || saving) return;
    const timer = setTimeout(() => {
      void save();
    }, 1000);
    return () => clearTimeout(timer);
  }, [dirty, busy, saving, save]);

  // Keep the registry pointed at the latest save closure without re-registering every render.
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });
  useEffect(() => {
    register(post.id, dirty, () => saveRef.current());
    return () => unregister(post.id);
  }, [post.id, dirty, register, unregister]);

  const getDraftFields = useCallback(
    () => ({
      caption,
      hashtags,
      visualPrompt: isText ? null : visualPrompt,
      dpmoRationale: dpmoRationale.trim() ? dpmoRationale : null,
      postDate,
    }),
    [caption, dpmoRationale, hashtags, isText, postDate, visualPrompt],
  );

  const handleRegenerate = async () => {
    if (!onRegenerate) return;
    setRegenerating(true);
    setActionError(null);
    try {
      await onRegenerate(post.id);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Could not regenerate post draft.");
    } finally {
      setRegenerating(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    setDeleting(true);
    setActionError(null);
    try {
      await onDelete(post.id);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Could not delete post.");
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const submitForGeneration = useCallback(async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmitForGeneration(post.id);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Could not submit for generation.");
    } finally {
      setSubmitting(false);
    }
  }, [onSubmitForGeneration, post.id]);

  const copyValue = buildCaptionWithHashtags(caption, hashtags);
  const approved = Boolean(post.approvedAt);

  return (
    <article className="rounded-2xl border border-white/[0.08] bg-[#12151C]/90 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#FFD34E]">
            {postTypeIcon(post.postType)} {post.postType}
            {post.contentLane === "impromptu" ? <span className="ml-2 text-white/40">Impromptu</span> : null}
          </p>
          {onRegenerate ? (
            <button
              type="button"
              disabled={busy || regenerating || deleting}
              onClick={() => void handleRegenerate()}
              className="rounded border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/70 hover:bg-white/[0.08] hover:text-[#FFD34E] transition-colors"
              title="Regenerate this singular post"
            >
              {regenerating ? "REGENERATING…" : "↻ REGENERATE"}
            </button>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <p className="text-[10px] uppercase tracking-wide text-white/40">
            {post.targetGroup}
            {approved ? <span className="ml-2 font-bold text-emerald-300">Approved</span> : null}
          </p>
          {onDelete ? (
            confirmDelete ? (
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-[#FFB4B4]">Delete?</span>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => void handleDelete()}
                  className="rounded bg-red-600/40 border border-red-500/50 px-1.5 py-0.5 text-[9px] font-bold text-red-200 hover:bg-red-600/70"
                >
                  {deleting ? "…" : "YES"}
                </button>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => setConfirmDelete(false)}
                  className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] text-white/60 hover:text-white"
                >
                  NO
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={busy || deleting || regenerating}
                onClick={() => setConfirmDelete(true)}
                className="rounded border border-red-500/20 bg-red-500/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-300/60 hover:border-red-500/40 hover:bg-red-500/15 hover:text-red-200 transition-colors"
                title="Delete this post from Content Hub"
              >
                ✕ DELETE
              </button>
            )
          ) : null}
        </div>
      </div>

      <div className="mt-3 space-y-2">
        <p className={adminLabelClass}>{isText ? "Theme" : "Image / video summary & goal"}</p>
        <p className="rounded-xl border border-white/[0.06] bg-black/20 p-3 text-xs leading-relaxed text-white/70">
          <span className="font-semibold text-white/85">{post.theme || "Untitled theme"}</span>
          {post.cta ? <span className="block text-white/50">Goal: {post.cta}</span> : null}
        </p>
        {!isText ? (
          post.mediaUrls.length ? (
            <div className="grid grid-cols-3 gap-2">
              {post.mediaUrls.map((url, i) => (
                <a
                  key={`${url}_${i}`}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="overflow-hidden rounded-lg border border-white/[0.08] bg-black/30"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={`${post.postType} preview ${i + 1}`} className="h-24 w-full object-cover" />
                </a>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-white/40">
              Media is generated by the media agent automatically after Approve Day.
            </p>
          )
        ) : null}
      </div>

      {!isText ? (
        <ReferenceFilesField
          post={post}
          onPatch={onPatch}
          getDraftFields={getDraftFields}
          disabled={busy || deleting || regenerating}
        />
      ) : null}

      <label className="mt-3 block">
        <span className={adminLabelClass}>{isText ? "Text post" : "Caption"}</span>
        <textarea
          className={`${adminInputClassSm} mt-1 min-h-[130px]`}
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
        />
      </label>

      {!isText ? (
        <label className="mt-3 block">
          <span className={adminLabelClass}>Generation prompt (dimensions, brand colors & logo included)</span>
          <textarea
            className={`${adminInputClassSm} mt-1 min-h-[110px] font-mono text-[11px]`}
            value={visualPrompt}
            onChange={(e) => setVisualPrompt(e.target.value)}
          />
        </label>
      ) : null}

      <div className="mt-3">
        <span className={adminLabelClass}>Hashtags</span>
        <ContentHashtagTagInput tags={hashtags} onChange={setHashtags} />
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between">
          <span className={adminLabelClass}>How this fits the DPMO</span>
          <button
            type="button"
            className="text-[10px] font-bold uppercase tracking-wide text-white/45 hover:text-white/70"
            onClick={() => setEditDpmo((v) => !v)}
          >
            {editDpmo ? "Done" : "Edit"}
          </button>
        </div>
        {editDpmo ? (
          <textarea
            className={`${adminInputClassSm} mt-1 min-h-[72px]`}
            value={dpmoRationale}
            placeholder="Plain English: how this post moves the current growth phase forward, and the strategy behind it."
            onChange={(e) => setDpmoRationale(e.target.value)}
          />
        ) : (
          <p className="mt-1 rounded-xl border border-white/[0.06] bg-black/20 p-3 text-sm leading-relaxed text-white/75">
            {dpmoRationale.trim()
              ? dpmoRationale
              : "A plain-English DPMO rationale is written when this post is generated — it explains how the post fits the current growth phase and the strategy behind it."}
          </p>
        )}
      </div>

      <label className="mt-3 block">
        <span className={adminLabelClass}>Goes up on</span>
        <input
          type="date"
          className={`${adminInputClassSm} mt-1 max-w-[200px]`}
          value={postDate}
          onChange={(e) => setPostDate(e.target.value)}
        />
      </label>

      <div className="mt-3 flex flex-wrap gap-2">
        <CopyButton value={copyValue} label="COPY POST" />
        {!isText ? <CopyButton value={visualPrompt} label="COPY PROMPT" /> : null}
        {isImpromptu ? (
          <button
            type="button"
            className={adminPrimaryButtonClass}
            disabled={busy || saving || submitting}
            onClick={() => void submitForGeneration()}
          >
            {submitting ? "SUBMITTING…" : "SUBMIT FOR GENERATION"}
          </button>
        ) : null}
        <button
          type="button"
          className={adminSecondaryButtonClass}
          disabled={busy || saving || !dirty}
          onClick={() => void save()}
        >
          {saving ? "SAVING…" : dirty ? "AUTO-SAVING…" : "SAVED"}
        </button>
      </div>
      {submitError ? <p className="mt-2 text-[11px] font-semibold text-[#FFB4B4]">{submitError}</p> : null}
      {actionError ? <p className="mt-2 text-[11px] font-semibold text-[#FFB4B4]">{actionError}</p> : null}
    </article>
  );
}
