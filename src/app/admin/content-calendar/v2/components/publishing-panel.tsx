"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  adminAccentButtonClass,
  adminCardClass,
  adminInputClassSm,
  adminLabelClass,
  adminPrimaryButtonClass,
  adminSecondaryButtonClass,
} from "@/components/admin/admin-portal-ui";
import { ContentHashtagTagInput } from "@/components/admin/content-hashtag-tag-input";
import { buildCaptionWithHashtags } from "@/lib/content-calendar/content-calendar-clipboard";
import { CONTENT_CALENDAR_POST_TYPES, type ContentCalendarPostType } from "@/lib/content-calendar/constants";
import type { ClientContentCalendarV2Post } from "@/lib/content-calendar/content-calendar-v2-store";
import { DeviceMediaUploadWidget } from "./device-media-upload-widget";
import { CopyButton, Modal, PipelineHealthBanner, ProgressBar, SeePromptCollapsible } from "./ui-bits";
import { useSimulatedProgress } from "./use-simulated-progress";
import {
  collectPublishingPlatforms,
  defaultPlatformsForPost,
  EMPTY_PUBLISHING_FILTERS,
  matchesPublishingFilters,
  platformPreviewUrl,
  postTypeIcon,
  type PublishingFilters,
} from "./helpers";

function isVideoUrl(url: string): boolean {
  return /\.(mp4|mov|webm|m4v)(\?|$)/i.test(url);
}

function arraysEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

async function downloadDirectMedia(url: string, filename?: string) {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename || url.split("/").pop()?.split("?")[0] || "media-download";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  } catch {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || url.split("/").pop()?.split("?")[0] || "media-download";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
}

export function FullSizeMediaModal({
  urls,
  initialIndex = 0,
  postType,
  onClose,
}: {
  urls: string[];
  initialIndex?: number;
  postType: string;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(initialIndex);
  const currentUrl = urls[index] || urls[0];

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft" && urls.length > 1) {
        setIndex((i) => (i > 0 ? i - 1 : urls.length - 1));
      } else if (e.key === "ArrowRight" && urls.length > 1) {
        setIndex((i) => (i < urls.length - 1 ? i + 1 : 0));
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, urls.length]);

  if (!currentUrl) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 p-4 backdrop-blur-md"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <button
        type="button"
        aria-label="Close full size view"
        onClick={onClose}
        className="absolute top-4 right-4 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-lg font-bold text-white transition hover:bg-white/30"
      >
        ✕
      </button>

      {urls.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous item"
            onClick={() => setIndex((i) => (i > 0 ? i - 1 : urls.length - 1))}
            className="absolute left-4 top-1/2 z-50 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-2xl text-white transition hover:bg-white/30"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Next item"
            onClick={() => setIndex((i) => (i < urls.length - 1 ? i + 1 : 0))}
            className="absolute right-4 top-1/2 z-50 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-2xl text-white transition hover:bg-white/30"
          >
            ›
          </button>
        </>
      )}

      <div className="flex max-h-[90vh] max-w-[90vw] flex-col items-center justify-center">
        {isVideoUrl(currentUrl) ? (
          <video
            src={currentUrl}
            controls
            playsInline
            autoPlay
            preload="auto"
            className="max-h-[78vh] max-w-[85vw] rounded-xl object-contain shadow-2xl"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={currentUrl}
            alt={`${postType} full size`}
            className="max-h-[78vh] max-w-[85vw] rounded-xl object-contain shadow-2xl"
          />
        )}

        <div className="mt-4 flex items-center gap-3">
          {urls.length > 1 && (
            <span className="text-xs font-semibold text-white/70">
              {index + 1} of {urls.length}
            </span>
          )}
          <button
            type="button"
            className={adminPrimaryButtonClass}
            onClick={() => void downloadDirectMedia(currentUrl)}
          >
            DOWNLOAD NOW
          </button>
          <button
            type="button"
            className={adminSecondaryButtonClass}
            onClick={onClose}
          >
            CLOSE (ESC)
          </button>
        </div>
      </div>
    </div>
  );
}

function FilesModal({ post, onClose }: { post: ClientContentCalendarV2Post; onClose: () => void }) {
  function downloadText() {
    const blob = new Blob([post.caption], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `matchfit-${post.postType.toLowerCase()}-${post.postDate || "draft"}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <Modal title="Files" onClose={onClose} maxWidthClass="max-w-2xl">
      {post.postType === "Text" ? (
        <div className="space-y-3">
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-xl border border-white/[0.08] bg-black/30 p-3 text-xs text-white/80">
            {post.caption}
          </pre>
          <button type="button" className={adminPrimaryButtonClass} onClick={downloadText}>
            DOWNLOAD NOW
          </button>
        </div>
      ) : post.mediaUrls.length ? (
        <div className="space-y-4">
          {post.mediaUrls.map((url, i) => (
            <div key={`${url}_${i}`} className="rounded-xl border border-white/[0.08] bg-black/30 p-3">
              {isVideoUrl(url) ? (
                <video src={url} controls playsInline preload="metadata" className="max-h-72 w-full rounded-lg" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt={`${post.postType} file ${i + 1}`} className="max-h-72 w-full rounded-lg object-contain" />
              )}
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => void downloadDirectMedia(url)}
                  className={adminPrimaryButtonClass}
                >
                  DOWNLOAD NOW
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-white/55">No media files attached yet — the media agent generates it automatically after Approve Day.</p>
      )}
    </Modal>
  );
}

function ChangeDateModal({
  post,
  busy,
  onClose,
  onSaveDate,
}: {
  post: ClientContentCalendarV2Post;
  busy: boolean;
  onClose: () => void;
  onSaveDate: (newDate: string) => Promise<void>;
}) {
  const [value, setValue] = useState(
    post.postDate || new Date().toISOString().slice(0, 10),
  );

  return (
    <Modal title="Change Post Date" onClose={onClose}>
      <p className="text-xs leading-relaxed text-white/55">
        Updates the calendar date for this post without scheduling it for automated publishing. The post remains in Publishing.
      </p>
      <input
        type="date"
        className={`${adminInputClassSm} mt-3 max-w-[220px]`}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" className={adminSecondaryButtonClass} onClick={onClose}>
          CANCEL
        </button>
        <button
          type="button"
          className={adminPrimaryButtonClass}
          disabled={busy || !value}
          onClick={() => void onSaveDate(value)}
        >
          {busy ? "SAVING…" : "SAVE DATE"}
        </button>
      </div>
    </Modal>
  );
}

function PublishingCard({
  post,
  busy,
  ready,
  excluded,
  onExcludedChange,
  onPatch,
  onAction,
  onToggleReady,
  onApproveForPosting,
  register,
  unregister,
}: {
  post: ClientContentCalendarV2Post;
  busy: boolean;
  ready: boolean;
  excluded: string[];
  onExcludedChange: (id: string, next: string[]) => void;
  onPatch: (id: string, fields: Partial<ClientContentCalendarV2Post>) => Promise<void>;
  onAction: (id: string, body: Record<string, unknown>, success?: string) => Promise<void>;
  onToggleReady: (id: string, ready: boolean) => void;
  onApproveForPosting: (
    postIds: string[],
    platformOverrides?: Record<string, string[]>,
  ) => Promise<{ jobId?: string; postCount?: number }>;
  register: (key: string, dirty: boolean, save: () => Promise<void>) => void;
  unregister: (key: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [caption, setCaption] = useState(post.caption);
  const [hashtags, setHashtags] = useState<string[]>(post.hashtags);
  const [showFiles, setShowFiles] = useState(false);
  const [showChangeDate, setShowChangeDate] = useState(false);
  const [fullSizeIndex, setFullSizeIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // Regenerate via agent — optional feedback textarea, then regenerate_via_agent moves the post to
  // Pending. TAB_FOLLOW_ACTIONS in the client already switches tabs on this action, and onAction
  // always refetches the current stage, so the card just disappears from this list on success —
  // nothing to remove by hand here.
  const [showRegenerate, setShowRegenerate] = useState(false);
  const [regenerateFeedback, setRegenerateFeedback] = useState("");
  const [regenerating, setRegenerating] = useState(false);

  // Manually Redo — reveals the device upload widget; manual_redo_media overwrites media in place
  // server-side (works identically for a post that already has media and one that has none yet, e.g.
  // the day-level Manually Generate Media bypass), so there's no separate delete step needed.
  const [showManualRedo, setShowManualRedo] = useState(false);
  const [redoBusy, setRedoBusy] = useState(false);
  const [redoError, setRedoError] = useState<string | null>(null);

  // Manually Post — irreversible (archives the post), so it gets the same confirm-dialog pattern
  // Approve For Posting already uses below.
  const [posting, setPosting] = useState(false);

  // Agent Post — the per-post counterpart to Manually Post, giving Publishing the paired
  // MANUALLY POST / AGENT POST buttons the spec asked for on every card, not just via the batch
  // "mark ready then APPROVE FOR POSTING" flow below. Reuses that same single-post-array call.
  const [agentPosting, setAgentPosting] = useState(false);
  const [agentPostError, setAgentPostError] = useState<string | null>(null);

  useEffect(() => {
    queueMicrotask(() => {
      setCaption(post.caption);
      setHashtags(post.hashtags);
    });
  }, [post]);

  const platforms = defaultPlatformsForPost(post);
  const activePlatforms = platforms.filter((p) => !excluded.includes(p));
  const dirty = caption !== post.caption || !arraysEqual(hashtags, post.hashtags);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      await onPatch(post.id, { caption, hashtags });
    } finally {
      setSaving(false);
    }
  }, [caption, hashtags, onPatch, post.id]);

  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });
  useEffect(() => {
    register(`pub_${post.id}`, dirty, () => saveRef.current());
    return () => unregister(`pub_${post.id}`);
  }, [post.id, dirty, register, unregister]);

  // Mirrors RescheduleModal's onSchedule below: always await onAction, then close/reset local UI
  // regardless of outcome — onAction already swallows its own errors into the page-level error state
  // and always refetches the current stage, so there's no separate success/failure branch to handle
  // here.
  async function regenerate() {
    setRegenerating(true);
    try {
      const feedback = regenerateFeedback.trim();
      await onAction(
        post.id,
        feedback ? { action: "regenerate_via_agent", feedback } : { action: "regenerate_via_agent" },
        "Sent back to Pending for the agent to redo.",
      );
      setShowRegenerate(false);
      setRegenerateFeedback("");
    } finally {
      setRegenerating(false);
    }
  }

  async function manuallyRedoMedia(urls: string[]) {
    setRedoBusy(true);
    setRedoError(null);
    try {
      await onAction(post.id, { action: "manual_redo_media", mediaUrls: urls }, "Media updated.");
      setShowManualRedo(false);
    } finally {
      setRedoBusy(false);
    }
  }

  async function manuallyPost() {
    const confirmed = window.confirm(
      "Send this to Scheduled Posts to post it yourself? You'll press POSTED there once it's live.",
    );
    if (!confirmed) return;
    setPosting(true);
    try {
      await onAction(post.id, { action: "manual_post" }, "Moved to Scheduled Posts — press POSTED once it's live.");
    } finally {
      setPosting(false);
    }
  }

  async function removeMedia() {
    const confirmed = window.confirm("Remove the media from this post? You can upload or regenerate new media after.");
    if (!confirmed) return;
    setRedoBusy(true);
    setRedoError(null);
    try {
      await onAction(post.id, { action: "remove_media" }, "Media removed.");
    } finally {
      setRedoBusy(false);
    }
  }

  async function agentPost() {
    const confirmed = window.confirm(
      `Send this post to ${activePlatforms.length ? activePlatforms.join(", ") : "no platforms"}? This queues an immediate cross-post and cannot be undone.`,
    );
    if (!confirmed) return;
    setAgentPosting(true);
    setAgentPostError(null);
    try {
      await onApproveForPosting([post.id], excluded.length ? { [post.id]: activePlatforms } : undefined);
    } catch (e) {
      setAgentPostError(e instanceof Error ? e.message : "Could not post this via the agent.");
    } finally {
      setAgentPosting(false);
    }
  }

  return (
    <article className={`rounded-2xl border ${ready ? "border-emerald-400/40" : "border-white/[0.08]"} bg-[#12151C]/90`}>
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <button type="button" className="flex-1 text-left" onClick={() => setExpanded((v) => !v)}>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#FFD34E]">
            {postTypeIcon(post.postType)} {post.postType} · {post.postDate || "No date"}
          </p>
          <p className="mt-1 text-sm text-white/60">
            {post.theme || "Untitled"} · {post.targetGroup} · {post.cta || "No CTA"}
          </p>
        </button>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            className={ready ? adminSecondaryButtonClass : adminAccentButtonClass}
            disabled={busy || saving}
            onClick={async () => {
              if (!ready && dirty) await save();
              onToggleReady(post.id, !ready);
            }}
          >
            {ready ? "READY ✓ — UNMARK" : "PUBLISH"}
          </button>
          <button type="button" className={adminSecondaryButtonClass} onClick={() => setExpanded((v) => !v)}>
            {expanded ? "COLLAPSE" : "EXPAND"}
          </button>
        </div>
      </div>

      {expanded ? (
        <div className="space-y-4 border-t border-white/[0.06] p-4">
          {/* Media / text preview */}
          {post.postType === "Text" ? (
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-xl border border-white/[0.06] bg-black/20 p-3 text-xs text-white/75">
              {caption}
            </pre>
          ) : post.mediaUrls.length ? (
            <div className="space-y-2">
              {post.mediaUrls.length === 1 ? (
                <div className="group relative inline-block max-w-full overflow-hidden rounded-xl border border-white/[0.1] bg-black/40">
                  {isVideoUrl(post.mediaUrls[0]) ? (
                    <video
                      src={post.mediaUrls[0]}
                      controls
                      playsInline
                      preload="metadata"
                      className="max-h-[520px] w-auto max-w-full rounded-xl object-contain bg-black/40"
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={post.mediaUrls[0]}
                      alt={`${post.postType} preview`}
                      className="max-h-[520px] w-auto max-w-full cursor-pointer rounded-xl object-contain transition hover:opacity-95"
                      onClick={() => setFullSizeIndex(0)}
                    />
                  )}
                  <div className="absolute top-2 right-2 flex items-center gap-1.5 rounded-lg bg-black/75 p-1 backdrop-blur-sm">
                    <button
                      type="button"
                      title="View full size (ESC to close)"
                      className="rounded bg-white/10 px-2 py-1 text-[11px] font-semibold text-white/90 transition hover:bg-white/25 hover:text-white"
                      onClick={() => setFullSizeIndex(0)}
                    >
                      ⛶ FULL SIZE
                    </button>
                    <button
                      type="button"
                      title="Download file directly"
                      className="rounded bg-white/10 px-2 py-1 text-[11px] font-semibold text-white/90 transition hover:bg-white/25 hover:text-white"
                      onClick={() => void downloadDirectMedia(post.mediaUrls[0])}
                    >
                      ↓ DOWNLOAD
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {post.mediaUrls.map((url, i) => (
                    <div
                      key={`${url}_${i}`}
                      className="group relative overflow-hidden rounded-xl border border-white/[0.08] bg-black/30"
                    >
                      {isVideoUrl(url) ? (
                        <video
                          src={url}
                          controls
                          playsInline
                          preload="metadata"
                          className="max-h-80 w-full rounded-lg bg-black/20 object-contain"
                        />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={url}
                          alt={`${post.postType} ${i + 1}`}
                          className="max-h-80 w-full cursor-pointer rounded-lg bg-black/20 object-contain transition hover:opacity-95"
                          onClick={() => setFullSizeIndex(i)}
                        />
                      )}
                      <div className="absolute top-2 right-2 flex items-center gap-1 rounded-lg bg-black/75 p-1 opacity-90 backdrop-blur-sm transition sm:opacity-0 sm:group-hover:opacity-100">
                        <button
                          type="button"
                          title="View full size (ESC to close)"
                          className="rounded bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/90 transition hover:bg-white/25 hover:text-white"
                          onClick={() => setFullSizeIndex(i)}
                        >
                          ⛶ FULL SIZE
                        </button>
                        <button
                          type="button"
                          title="Download file directly"
                          className="rounded bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/90 transition hover:bg-white/25 hover:text-white"
                          onClick={() => void downloadDirectMedia(url)}
                        >
                          ↓ DOWNLOAD
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-white/10 bg-black/20 p-3 text-xs text-white/45">
              No media yet — generated by the media agent automatically after Approve Day.
            </p>
          )}

          {post.generationSource === "manual_upload" || post.generationSource === "cowork_gemini" ? (
            <p className="text-[10px] uppercase tracking-wide text-white/35">
              {post.generationSource === "manual_upload" ? "Manually uploaded media" : "Agent-generated media"}
            </p>
          ) : null}

          <SeePromptCollapsible prompt={post.lastGenerationPrompt} label="See Prompt" />

          {/* Per-platform variations with exclude checkboxes + preview links */}
          <div>
            <p className={adminLabelClass}>Platform variations (uncheck to exclude)</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {platforms.map((platform) => {
                const active = !excluded.includes(platform);
                return (
                  <div
                    key={platform}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${active ? "border-white/15 bg-white/[0.04] text-white/75" : "border-white/5 bg-white/[0.01] text-white/35"}`}
                  >
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={() =>
                        onExcludedChange(
                          post.id,
                          active ? [...excluded, platform] : excluded.filter((p) => p !== platform),
                        )
                      }
                    />
                    <span>{platform}</span>
                    <a
                      href={platformPreviewUrl(platform)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#FF7E00] underline-offset-2 hover:underline"
                      title={`Open a ${platform} preview / composer in a new tab`}
                    >
                      preview ↗
                    </a>
                  </div>
                );
              })}
            </div>
            <p className="mt-1 text-[10px] text-white/35">
              Active for posting: {activePlatforms.join(", ") || "none"}.
            </p>
          </div>

          {/* Caption + hashtags in two separate areas */}
          <label className="block">
            <span className={adminLabelClass}>Caption</span>
            <textarea
              className={`${adminInputClassSm} mt-1 min-h-[120px]`}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
            />
          </label>
          <div>
            <span className={adminLabelClass}>Hashtags</span>
            <ContentHashtagTagInput tags={hashtags} onChange={setHashtags} />
          </div>

          <div className="flex flex-wrap gap-2">
            <CopyButton value={buildCaptionWithHashtags(caption, hashtags)} label="COPY POST" />
            <button type="button" className={adminSecondaryButtonClass} onClick={() => setShowFiles(true)}>
              FILES
            </button>
            <button type="button" className={adminSecondaryButtonClass} onClick={() => setShowChangeDate(true)}>
              CHANGE DATE
            </button>
            <button
              type="button"
              className={adminSecondaryButtonClass}
              disabled={busy || saving || !dirty}
              onClick={() => void save()}
            >
              {saving ? "SAVING…" : dirty ? "SAVE EDITS" : "SAVED"}
            </button>
          </div>

          {/* Agent redo / manual redo / manual post — separated from the edit-and-save row above since
              these three change the post's stage or media, not just its text. */}
          <div className="flex flex-wrap gap-2 border-t border-white/[0.06] pt-3">
            <button
              type="button"
              className={adminSecondaryButtonClass}
              disabled={busy || regenerating}
              onClick={() => setShowRegenerate((v) => !v)}
            >
              Regenerate
            </button>
            <button
              type="button"
              className={adminSecondaryButtonClass}
              disabled={busy || redoBusy}
              onClick={() => setShowManualRedo((v) => !v)}
            >
              {post.mediaUrls.length ? "Replace Media" : "Upload Media"}
            </button>
            {post.mediaUrls.length ? (
              <button
                type="button"
                className={adminSecondaryButtonClass}
                disabled={busy || redoBusy}
                onClick={() => void removeMedia()}
              >
                Remove Media
              </button>
            ) : null}
            <button
              type="button"
              className={adminAccentButtonClass}
              disabled={busy || posting}
              onClick={() => void manuallyPost()}
            >
              {posting ? "Posting…" : "Manually Post"}
            </button>
            <button
              type="button"
              className={adminAccentButtonClass}
              disabled={busy || agentPosting}
              onClick={() => void agentPost()}
            >
              {agentPosting ? "Posting…" : "Agent Post"}
            </button>
          </div>
          {agentPostError ? <p className="text-xs font-semibold text-[#FFB4B4]">{agentPostError}</p> : null}

          {showRegenerate ? (
            <div className="space-y-2 rounded-xl border border-white/[0.08] bg-black/20 p-3">
              <label className="block">
                <span className={adminLabelClass}>Feedback for the agent (optional)</span>
                <textarea
                  className={`${adminInputClassSm} mt-1 min-h-[70px]`}
                  value={regenerateFeedback}
                  onChange={(e) => setRegenerateFeedback(e.target.value)}
                  placeholder="What should change this time?"
                />
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={adminPrimaryButtonClass}
                  disabled={busy || regenerating}
                  onClick={() => void regenerate()}
                >
                  {regenerating ? "Sending…" : "Send To Agent"}
                </button>
                <button
                  type="button"
                  className={adminSecondaryButtonClass}
                  disabled={regenerating}
                  onClick={() => {
                    setShowRegenerate(false);
                    setRegenerateFeedback("");
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}

          {showManualRedo ? (
            <div className="space-y-2 rounded-xl border border-white/[0.08] bg-black/20 p-3">
              <p className="text-xs text-white/55">
                {post.mediaUrls.length
                  ? "Uploading replaces the current media for this post."
                  : "No media yet — upload the first file for this post."}
              </p>
              <DeviceMediaUploadWidget
                postId={post.id}
                label="publishing-manual-redo"
                multiple
                buttonLabel="Upload New Media"
                disabled={busy || redoBusy}
                onUploaded={(urls) => void manuallyRedoMedia(urls)}
                onError={(message) => setRedoError(message)}
              />
              {redoError ? <p className="text-xs font-semibold text-[#FFB4B4]">{redoError}</p> : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {showFiles ? <FilesModal post={post} onClose={() => setShowFiles(false)} /> : null}
      {showChangeDate ? (
        <ChangeDateModal
          post={post}
          busy={busy}
          onClose={() => setShowChangeDate(false)}
          onSaveDate={async (newDate) => {
            await onPatch(post.id, { postDate: newDate });
            setShowChangeDate(false);
          }}
        />
      ) : null}
      {fullSizeIndex !== null && post.mediaUrls.length > 0 ? (
        <FullSizeMediaModal
          urls={post.mediaUrls}
          initialIndex={fullSizeIndex}
          postType={post.postType}
          onClose={() => setFullSizeIndex(null)}
        />
      ) : null}
    </article>
  );
}

const STATUS_OPTIONS: { key: "unposted" | "posted"; label: string }[] = [
  { key: "unposted", label: "Unposted" },
  { key: "posted", label: "Posted" },
];

export function PublishingPanel({
  posts,
  busyId,
  onPatch,
  onAction,
  onApproveForPosting,
  register,
  unregister,
}: {
  posts: ClientContentCalendarV2Post[];
  busyId: string | null;
  onPatch: (id: string, fields: Partial<ClientContentCalendarV2Post>) => Promise<void>;
  onAction: (id: string, body: Record<string, unknown>, success?: string) => Promise<void>;
  onApproveForPosting: (
    postIds: string[],
    platformOverrides?: Record<string, string[]>,
  ) => Promise<{ jobId?: string; postCount?: number }>;
  register: (key: string, dirty: boolean, save: () => Promise<void>) => void;
  unregister: (key: string) => void;
}) {
  const [filters, setFilters] = useState<PublishingFilters>(EMPTY_PUBLISHING_FILTERS);
  const [readyIds, setReadyIds] = useState<Set<string>>(new Set());
  const [excludedByPost, setExcludedByPost] = useState<Record<string, string[]>>({});
  const [jobNote, setJobNote] = useState<string | null>(null);
  const [approveError, setApproveError] = useState<string | null>(null);
  const progress = useSimulatedProgress();

  const allPlatforms = useMemo(() => collectPublishingPlatforms(posts), [posts]);
  const filtered = useMemo(() => posts.filter((p) => matchesPublishingFilters(p, filters)), [posts, filters]);

  const toggleReady = useCallback((id: string, ready: boolean) => {
    setReadyIds((prev) => {
      const next = new Set(prev);
      if (ready) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const setExcluded = useCallback((id: string, next: string[]) => {
    setExcludedByPost((prev) => ({ ...prev, [id]: next }));
  }, []);

  function toggleFacet<T>(list: T[], value: T): T[] {
    return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
  }

  // Effective platforms a post will actually be sent to = its default platform checklist minus any
  // excluded platforms (mirrors what the card's "Active for posting" line shows).
  const activePlatformsFor = useCallback(
    (post: ClientContentCalendarV2Post): string[] => {
      const excluded = excludedByPost[post.id] ?? [];
      return defaultPlatformsForPost(post).filter((p) => !excluded.includes(p));
    },
    [excludedByPost],
  );

  async function approveForPosting() {
    // Selection semantics: only PUBLISH-marked (ready) posts within the current filter are sent.
    // There is no silent fallback to "everything currently filtered" — an empty selection is a real
    // validation error, not an invitation to post the whole filtered list.
    if (!filtered.length) {
      setApproveError("No posts match the current filters to approve for posting.");
      return;
    }
    const ids = filtered.filter((p) => readyIds.has(p.id)).map((p) => p.id);
    if (!ids.length) {
      setApproveError("SELECT POSTS TO PUBLISH");
      return;
    }

    // Only posts with an actual exclusion send an override; untouched posts fall back to their
    // stored platforms server-side (backward compatible).
    const platformOverrides: Record<string, string[]> = {};
    const platformSet = new Set<string>();
    for (const id of ids) {
      const post = filtered.find((p) => p.id === id);
      if (!post) continue;
      const active = activePlatformsFor(post);
      active.forEach((p) => platformSet.add(p));
      if ((excludedByPost[id] ?? []).length) platformOverrides[id] = active;
    }
    const platformSummary = [...platformSet].sort();

    // Always confirm — one irreversible cross-post batch, so state the exact scope first.
    const confirmed = window.confirm(
      `Send ${ids.length} post${ids.length === 1 ? "" : "s"} to ${platformSummary.length ? platformSummary.join(", ") : "no platforms"}? This queues an immediate cross-post batch and cannot be undone.`,
    );
    if (!confirmed) return;

    setApproveError(null);
    setJobNote(null);
    progress.start();
    try {
      const result = await onApproveForPosting(ids, Object.keys(platformOverrides).length ? platformOverrides : undefined);
      progress.finish();
      setJobNote(
        `Approved ${result.postCount ?? ids.length} post${(result.postCount ?? ids.length) === 1 ? "" : "s"} for posting — media agent batch queued${result.jobId ? ` (${result.jobId})` : ""}.`,
      );
      setReadyIds(new Set());
    } catch (e) {
      progress.fail();
      setApproveError(e instanceof Error ? e.message : "Could not approve for posting.");
    }
  }

  return (
    <section className={adminCardClass}>
      <PipelineHealthBanner />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-black uppercase tracking-[0.12em] text-white">Publishing</h2>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-white/55">
            Each post has its own Agent Post button to send it immediately, or mark several posts ready with PUBLISH
            and use APPROVE FOR POSTING below to batch them into one cross-post job for the media agent. Manually Post schedules a
            post you posted yourself instead. Posted posts stay visible for the retention window, then move to
            Archives automatically.
          </p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="mt-5 grid gap-3 rounded-2xl border border-white/[0.06] bg-[#0E1016]/80 p-4 lg:grid-cols-2">
        <div className="grid grid-cols-2 gap-2">
          <label>
            <span className={adminLabelClass}>From date</span>
            <input
              type="date"
              className={`${adminInputClassSm} mt-1`}
              value={filters.fromDate}
              onChange={(e) => setFilters((f) => ({ ...f, fromDate: e.target.value }))}
            />
          </label>
          <label>
            <span className={adminLabelClass}>To date</span>
            <input
              type="date"
              className={`${adminInputClassSm} mt-1`}
              value={filters.toDate}
              onChange={(e) => setFilters((f) => ({ ...f, toDate: e.target.value }))}
            />
          </label>
        </div>
        <div className="space-y-2">
          <div>
            <span className={adminLabelClass}>Status</span>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {STATUS_OPTIONS.map((opt) => (
                <FilterChip
                  key={opt.key}
                  active={filters.statuses.includes(opt.key)}
                  label={opt.label}
                  onClick={() => setFilters((f) => ({ ...f, statuses: toggleFacet(f.statuses, opt.key) }))}
                />
              ))}
            </div>
          </div>
          <div>
            <span className={adminLabelClass}>Type of post</span>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {CONTENT_CALENDAR_POST_TYPES.map((type) => (
                <FilterChip
                  key={type}
                  active={filters.postTypes.includes(type)}
                  label={type}
                  onClick={() =>
                    setFilters((f) => ({ ...f, postTypes: toggleFacet(f.postTypes, type as ContentCalendarPostType) }))
                  }
                />
              ))}
            </div>
          </div>
          {allPlatforms.length ? (
            <div>
              <span className={adminLabelClass}>Platform</span>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {allPlatforms.map((platform) => (
                  <FilterChip
                    key={platform}
                    active={filters.platforms.includes(platform)}
                    label={platform}
                    onClick={() => setFilters((f) => ({ ...f, platforms: toggleFacet(f.platforms, platform) }))}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-white/45">
          Showing {filtered.length} of {posts.length} · {readyIds.size} marked ready
        </p>
        <button
          type="button"
          className={adminPrimaryButtonClass}
          disabled={progress.active || !filtered.length}
          onClick={() => void approveForPosting()}
        >
          APPROVE FOR POSTING
        </button>
      </div>

      {progress.active ? (
        <div className="mt-3">
          <ProgressBar percent={progress.percent} label="Queuing media agent post batch" />
        </div>
      ) : null}
      {jobNote ? <p className="mt-3 text-xs font-semibold text-emerald-300">{jobNote}</p> : null}
      {approveError ? <p className="mt-3 text-xs font-semibold text-[#FFB4B4]">{approveError}</p> : null}

      <div className="mt-5 space-y-3">
        {filtered.map((post) => (
          <PublishingCard
            key={post.id}
            post={post}
            busy={busyId === post.id}
            ready={readyIds.has(post.id)}
            excluded={excludedByPost[post.id] ?? []}
            onExcludedChange={setExcluded}
            onPatch={onPatch}
            onAction={onAction}
            onToggleReady={toggleReady}
            onApproveForPosting={onApproveForPosting}
            register={register}
            unregister={unregister}
          />
        ))}
        {!filtered.length ? (
          <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-10 text-center text-sm text-white/45">
            {posts.length ? "No posts match the current filters." : "No posts in Publishing yet. Approve a day in the Hub to generate media here."}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function FilterChip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "rounded-full border border-[#FF7E00]/50 bg-[#FF7E00]/15 px-3 py-1 text-[11px] font-bold text-[#FFD34E]"
          : "rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] font-bold text-white/50 transition hover:border-white/20"
      }
    >
      {label}
    </button>
  );
}
