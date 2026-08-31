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
import type { ClientContentCalendarV2Post } from "@/lib/content-calendar/content-calendar-v2-store";
import { defaultPlatformsForPost, postTypeIcon } from "./helpers";
import { Modal, ProgressBar, SeePromptCollapsible } from "./ui-bits";
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
  register,
  unregister,
}: {
  post: ClientContentCalendarV2Post;
  busy: boolean;
  onStop: (post: ClientContentCalendarV2Post) => void;
  onPatch: (id: string, fields: Partial<ClientContentCalendarV2Post>) => Promise<void>;
  register: (key: string, dirty: boolean, save: () => Promise<void>) => void;
  unregister: (key: string) => void;
}) {
  const progress = usePendingProgress(post);
  const platforms = defaultPlatformsForPost(post);
  const isMediaPost = post.postType !== "Text";

  const [expanded, setExpanded] = useState(false);
  const [caption, setCaption] = useState(post.caption);
  const [hashtags, setHashtags] = useState<string[]>(post.hashtags);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      setCaption(post.caption);
      setHashtags(post.hashtags);
    });
  }, [post]);

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
    register(`pending_${post.id}`, dirty, () => saveRef.current());
    return () => unregister(`pending_${post.id}`);
  }, [post.id, dirty, register, unregister]);

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

          <p className="mt-3 text-xs uppercase tracking-wide text-white/40">What it says</p>
          <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed text-white/65">
            {captionPreview(caption)}
          </p>

          {isMediaPost ? (
            <div className="mt-4 max-w-sm">
              <ProgressBar percent={progress.percent} label={progress.active ? "Building media" : "Media"} />
              <p className="mt-1.5 text-xs text-white/50">{progress.etaLabel}</p>
            </div>
          ) : (
            <p className="mt-4 text-xs text-white/50">Text posts need no media build — waiting to move on.</p>
          )}

          <div className="mt-3">
            <SeePromptCollapsible prompt={post.lastGenerationPrompt} />
          </div>
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
          <div>
            <span className={adminLabelClass}>Hashtags</span>
            <ContentHashtagTagInput tags={hashtags} onChange={setHashtags} />
          </div>
          <button
            type="button"
            className={adminPrimaryButtonClass}
            disabled={busy || saving || !dirty}
            onClick={() => void save()}
          >
            {saving ? "Saving…" : dirty ? "Save Edits" : "Saved"}
          </button>
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
