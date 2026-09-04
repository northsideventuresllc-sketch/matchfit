"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  adminCardClass,
  adminInputClassSm,
  adminLabelClass,
  adminPrimaryButtonClass,
  adminSecondaryButtonClass,
} from "@/components/admin/admin-portal-ui";
import { ContentHashtagTagInput } from "@/components/admin/content-hashtag-tag-input";
import { buildCaptionWithHashtags } from "@/lib/content-calendar/content-calendar-clipboard";
import type { ClientContentCalendarV2Post } from "@/lib/content-calendar/content-calendar-v2-store";
import { DeviceMediaUploadWidget } from "./device-media-upload-widget";
import { defaultPlatformsForPost, postTypeIcon } from "./helpers";
import { CopyButton, Modal, PipelineHealthBanner, ProgressBar, SeePromptCollapsible } from "./ui-bits";
import { usePendingProgress } from "./use-pending-progress";

/** "Monday, Jul 27" from a YYYY-MM-DD date, or a plain fallback. */
function plainPostDate(postDate: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(postDate)) return "No day set yet";
  const parsed = new Date(`${postDate}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return "No day set yet";
  return parsed.toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function captionPreview(caption: string): string {
  const clean = caption.replace(/\s+/g, " ").trim();
  if (!clean) return "No caption written yet.";
  return clean.length <= 220 ? clean : `${clean.slice(0, 220).trimEnd()}…`;
}

function arraysEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function PendingCard({
  post,
  busy,
  onStop,
  onPatch,
  onAction,
  register,
  unregister,
}: {
  post: ClientContentCalendarV2Post;
  busy: boolean;
  onStop: (post: ClientContentCalendarV2Post) => void;
  onPatch: (id: string, fields: Partial<ClientContentCalendarV2Post>) => Promise<void>;
  onAction: (id: string, body: Record<string, unknown>, success?: string) => Promise<void>;
  register: (key: string, dirty: boolean, save: () => Promise<void>) => void;
  unregister: (key: string) => void;
}) {
  const progress = usePendingProgress(post);
  const platforms = defaultPlatformsForPost(post);
  const isMediaPost = post.postType !== "Text";
  // A media post is "building" only while it is actively generating. Manual-generate / manual-prompt
  // posts sit in Pending without a live build, so they show editable fields + upload instead of a bar.
  const building = isMediaPost && post.mediaStatus === "generating";

  const [expanded, setExpanded] = useState(!building);
  const [caption, setCaption] = useState(post.caption);
  const [hashtags, setHashtags] = useState<string[]>(post.hashtags);
  const [visualPrompt, setVisualPrompt] = useState(post.visualPrompt ?? "");
  const [saving, setSaving] = useState(false);
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([]);
  const [cardError, setCardError] = useState<string | null>(null);

  useEffect(() => {
    queueMicrotask(() => {
      setCaption(post.caption);
      setHashtags(post.hashtags);
      setVisualPrompt(post.visualPrompt ?? "");
    });
  }, [post]);

  const dirty =
    caption !== post.caption ||
    !arraysEqual(hashtags, post.hashtags) ||
    (isMediaPost && visualPrompt !== (post.visualPrompt ?? ""));

  const save = useCallback(async () => {
    setSaving(true);
    try {
      await onPatch(post.id, { caption, hashtags, visualPrompt: isMediaPost ? visualPrompt : null });
    } finally {
      setSaving(false);
    }
  }, [caption, hashtags, isMediaPost, onPatch, post.id, visualPrompt]);

  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });
  useEffect(() => {
    register(`pending_${post.id}`, dirty, () => saveRef.current());
    return () => unregister(`pending_${post.id}`);
  }, [post.id, dirty, register, unregister]);

  const copyValue = buildCaptionWithHashtags(caption, hashtags);
  const hasUpload = uploadedUrls.length > 0 || post.mediaUrls.length > 0;

  return (
    <article className="rounded-2xl border border-white/[0.08] bg-[#12151C]/90 p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#FFD34E]">
            {postTypeIcon(post.postType)} {post.postType} · {plainPostDate(post.postDate)}
          </p>
          <p className="mt-1 text-sm text-white/60">
            {post.theme || "Untitled"} · {post.targetGroup} · {post.cta || "No CTA"}
          </p>

          <p className="mt-3 text-xs uppercase tracking-wide text-white/40">Goes to</p>
          <p className="text-sm text-white/70">{platforms.length ? platforms.join(", ") : "No places picked yet"}</p>

          {building ? (
            <>
              <p className="mt-3 text-xs uppercase tracking-wide text-white/40">What it says</p>
              <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed text-white/65">
                {captionPreview(caption)}
              </p>
              <div className="mt-4 max-w-sm">
                <ProgressBar percent={progress.percent} label={progress.active ? "Building media" : "Media"} />
                <p className="mt-1.5 text-xs text-white/50">{progress.etaLabel}</p>
              </div>
              <div className="mt-3">
                <SeePromptCollapsible prompt={post.lastGenerationPrompt} />
              </div>
            </>
          ) : (
            <p className="mt-3 text-xs text-white/50">
              {isMediaPost
                ? "Review and edit this post below, then generate its media or upload your own."
                : "Text post — review it below, then approve it for publishing."}
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
          <button type="button" className={adminSecondaryButtonClass} onClick={() => setExpanded((v) => !v)}>
            {expanded ? "Collapse" : "Edit"}
          </button>
          <button type="button" className={adminSecondaryButtonClass} disabled={busy} onClick={() => onStop(post)}>
            {busy ? "Stopping…" : "Stop"}
          </button>
        </div>
      </div>

      {expanded ? (
        <div className="mt-4 space-y-3 border-t border-white/[0.06] pt-4">
          <label className="block">
            <span className={adminLabelClass}>Caption</span>
            <textarea
              className={`${adminInputClassSm} mt-1 min-h-[100px]`}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
            />
          </label>

          {isMediaPost ? (
            <label className="block">
              <span className={adminLabelClass}>Generation prompt</span>
              <textarea
                className={`${adminInputClassSm} mt-1 min-h-[90px] font-mono text-[11px]`}
                value={visualPrompt}
                onChange={(e) => setVisualPrompt(e.target.value)}
              />
            </label>
          ) : null}

          <div>
            <span className={adminLabelClass}>Hashtags</span>
            <ContentHashtagTagInput tags={hashtags} onChange={setHashtags} />
          </div>

          <div className="flex flex-wrap gap-2">
            <CopyButton value={copyValue} label="COPY POST" />
            {isMediaPost ? <CopyButton value={visualPrompt} label="COPY PROMPT" /> : null}
            <button
              type="button"
              className={adminSecondaryButtonClass}
              disabled={busy || saving || !dirty}
              onClick={() => void save()}
            >
              {saving ? "Saving…" : dirty ? "Save Edits" : "Saved"}
            </button>
          </div>

          {!building ? (
            <div className="flex flex-wrap gap-2 border-t border-white/[0.06] pt-3">
              {isMediaPost ? (
                <>
                  <button
                    type="button"
                    className={adminSecondaryButtonClass}
                    disabled={busy}
                    onClick={() =>
                      void onAction(post.id, { action: "regenerate_via_agent" }, "Media generation started.")
                    }
                  >
                    GENERATE NOW
                  </button>
                  <DeviceMediaUploadWidget
                    postId={post.id}
                    multiple={post.postType === "Carousel"}
                    buttonLabel="UPLOAD MEDIA"
                    disabled={busy}
                    onUploaded={(urls) => {
                      setUploadedUrls((prev) => [...prev, ...urls]);
                      setCardError(null);
                    }}
                    onError={(m) => setCardError(m)}
                  />
                </>
              ) : null}
              <button
                type="button"
                className={adminPrimaryButtonClass}
                disabled={busy || (isMediaPost && !hasUpload)}
                title={isMediaPost && !hasUpload ? "Upload media (or generate it) first" : undefined}
                onClick={() =>
                  void onAction(
                    post.id,
                    { action: "approve_for_publishing", ...(uploadedUrls.length ? { mediaUrls: uploadedUrls } : {}) },
                    "Approved for publishing.",
                  )
                }
              >
                APPROVE FOR PUBLISHING
              </button>
            </div>
          ) : null}

          {uploadedUrls.length ? (
            <p className="text-[11px] text-emerald-300">
              {uploadedUrls.length} file{uploadedUrls.length === 1 ? "" : "s"} uploaded — ready to approve.
            </p>
          ) : null}
          {cardError ? <p className="text-[11px] font-semibold text-[#FFB4B4]">{cardError}</p> : null}
        </div>
      ) : null}
    </article>
  );
}

export function PendingTabPanel({
  posts,
  busyId,
  onPatch,
  onAction,
  register,
  unregister,
}: {
  posts: ClientContentCalendarV2Post[];
  busyId: string | null;
  onPatch: (id: string, fields: Partial<ClientContentCalendarV2Post>) => Promise<void>;
  onAction: (id: string, body: Record<string, unknown>, success?: string) => Promise<void>;
  register: (key: string, dirty: boolean, save: () => Promise<void>) => void;
  unregister: (key: string) => void;
}) {
  const [confirming, setConfirming] = useState<ClientContentCalendarV2Post | null>(null);
  const [stopError, setStopError] = useState<string | null>(null);

  const readyCount = posts.filter((p) => p.postType === "Text" || p.mediaStatus === "ready").length;

  const stop = useCallback(
    async (post: ClientContentCalendarV2Post) => {
      setStopError(null);
      try {
        await onAction(
          post.id,
          { action: "back_to_drafts" },
          `Sent "${post.theme || post.postType}" back to the Content Hub.`,
        );
        setConfirming(null);
      } catch (e) {
        setStopError(e instanceof Error ? e.message : "Could not send that post back to the Content Hub.");
      }
    },
    [onAction],
  );

  return (
    <section className={adminCardClass}>
      <PipelineHealthBanner />
      <div>
        <h2 className="text-lg font-black uppercase tracking-[0.12em] text-white">Pending</h2>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-white/55">
          Posts here are queued for media generation before they move on to Publishing. Stop sends a post back to the
          Content Hub — any media already built stays attached.
        </p>
        {posts.length ? (
          <p className="mt-2 text-xs text-white/45">
            {posts.length} post{posts.length === 1 ? "" : "s"} pending · {readyCount} ready to move on ·{" "}
            {posts.length - readyCount} still building.
          </p>
        ) : null}
      </div>

      {stopError ? <p className="mt-3 text-xs font-semibold text-[#FFB4B4]">{stopError}</p> : null}

      <div className="mt-5 space-y-3">
        {posts.map((post) => (
          <PendingCard
            key={post.id}
            post={post}
            busy={busyId === post.id}
            onStop={setConfirming}
            onPatch={onPatch}
            onAction={onAction}
            register={register}
            unregister={unregister}
          />
        ))}
        {!posts.length ? (
          <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-10 text-center text-sm text-white/45">
            Nothing is pending right now.
          </div>
        ) : null}
      </div>

      {confirming ? (
        <Modal title="Stop this post?" onClose={() => setConfirming(null)}>
          <p className="text-sm leading-relaxed text-white/80">
            This sends the {confirming.postType.toLowerCase()} post for {plainPostDate(confirming.postDate)} back to
            the Content Hub instead of building or publishing it.
          </p>
          <p className="mt-2 text-xs text-white/50">Any media already generated for it stays attached.</p>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <button type="button" className={adminSecondaryButtonClass} onClick={() => setConfirming(null)}>
              Keep It Pending
            </button>
            <button
              type="button"
              className={adminSecondaryButtonClass}
              disabled={busyId === confirming.id}
              onClick={() => void stop(confirming)}
            >
              {busyId === confirming.id ? "Stopping…" : "Stop — Send Back To Hub"}
            </button>
          </div>
        </Modal>
      ) : null}
    </section>
  );
}
