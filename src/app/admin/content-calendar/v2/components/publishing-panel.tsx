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
import { CONTENT_CALENDAR_POST_TYPES, type ContentCalendarPostType } from "@/lib/content-calendar/constants";
import type { ClientContentCalendarV2Post } from "@/lib/content-calendar/content-calendar-v2-store";
import { CopyButton, Modal, ProgressBar } from "./ui-bits";
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
                <video src={url} controls className="max-h-72 w-full rounded-lg" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt={`${post.postType} file ${i + 1}`} className="max-h-72 w-full rounded-lg object-contain" />
              )}
              <a href={url} download target="_blank" rel="noreferrer" className={`${adminPrimaryButtonClass} mt-3 inline-flex`}>
                DOWNLOAD NOW
              </a>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-white/55">No media files attached yet — Cowork generates media after Fire Cowork.</p>
      )}
    </Modal>
  );
}

function RescheduleModal({
  post,
  busy,
  onClose,
  onSchedule,
}: {
  post: ClientContentCalendarV2Post;
  busy: boolean;
  onClose: () => void;
  onSchedule: (isoDateTime: string) => Promise<void>;
}) {
  const initial = post.scheduledAt
    ? new Date(post.scheduledAt)
    : new Date(`${post.postDate || new Date().toISOString().slice(0, 10)}T10:00:00`);
  const pad = (n: number) => String(n).padStart(2, "0");
  const [value, setValue] = useState(
    `${initial.getFullYear()}-${pad(initial.getMonth() + 1)}-${pad(initial.getDate())}T${pad(initial.getHours())}:${pad(initial.getMinutes())}`,
  );

  return (
    <Modal title="Reschedule / set posting time" onClose={onClose}>
      <p className="text-xs leading-relaxed text-white/55">
        Scheduling moves this post into Scheduled Posts with the chosen date and time (uses the schedule action).
      </p>
      <input
        type="datetime-local"
        className={`${adminInputClassSm} mt-3`}
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
          onClick={() => void onSchedule(new Date(value).toISOString())}
        >
          {busy ? "SCHEDULING…" : "SCHEDULE"}
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
  register: (key: string, dirty: boolean, save: () => Promise<void>) => void;
  unregister: (key: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [caption, setCaption] = useState(post.caption);
  const [hashtags, setHashtags] = useState<string[]>(post.hashtags);
  const [showFiles, setShowFiles] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);
  const [saving, setSaving] = useState(false);

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
            <div className="grid gap-2 sm:grid-cols-3">
              {post.mediaUrls.map((url, i) =>
                isVideoUrl(url) ? (
                  <video key={`${url}_${i}`} src={url} controls className="h-36 w-full rounded-lg object-cover" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={`${url}_${i}`} src={url} alt={`${post.postType} ${i + 1}`} className="h-36 w-full rounded-lg object-cover" />
                ),
              )}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-white/10 bg-black/20 p-3 text-xs text-white/45">
              No media yet — generated by Cowork after Fire Cowork.
            </p>
          )}

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
            <CopyButton value={caption} label="COPY CAPTION" />
            <button type="button" className={adminSecondaryButtonClass} onClick={() => setShowFiles(true)}>
              FILES
            </button>
            <button type="button" className={adminSecondaryButtonClass} onClick={() => setShowReschedule(true)}>
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
        </div>
      ) : null}

      {showFiles ? <FilesModal post={post} onClose={() => setShowFiles(false)} /> : null}
      {showReschedule ? (
        <RescheduleModal
          post={post}
          busy={busy}
          onClose={() => setShowReschedule(false)}
          onSchedule={async (iso) => {
            await onAction(post.id, { action: "schedule", scheduledAt: iso }, "Post scheduled.");
            setShowReschedule(false);
          }}
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
    // Selection semantics: PUBLISH-marked (ready) posts within the current filter win; if none are
    // marked ready, every currently-filtered post is sent.
    const readyFiltered = filtered.filter((p) => readyIds.has(p.id)).map((p) => p.id);
    const ids = readyFiltered.length ? readyFiltered : filtered.map((p) => p.id);
    if (!ids.length) {
      setApproveError("No posts match the current filters to approve for posting.");
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
        `Approved ${result.postCount ?? ids.length} post${(result.postCount ?? ids.length) === 1 ? "" : "s"} for posting — Cowork batch queued${result.jobId ? ` (${result.jobId})` : ""}.`,
      );
      setReadyIds(new Set());
    } catch (e) {
      progress.fail();
      setApproveError(e instanceof Error ? e.message : "Could not approve for posting.");
    }
  }

  return (
    <section className={adminCardClass}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-black uppercase tracking-[0.12em] text-white">Publishing</h2>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-white/55">
            Prepare each post per platform, mark it ready with PUBLISH, then APPROVE FOR POSTING batches the selected
            posts into a Cowork cross-post job. Posted posts stay visible for the retention window, then move to
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
          <ProgressBar percent={progress.percent} label="Queuing Cowork post batch" />
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
            register={register}
            unregister={unregister}
          />
        ))}
        {!filtered.length ? (
          <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-10 text-center text-sm text-white/45">
            {posts.length ? "No posts match the current filters." : "No posts in Publishing yet. Fire Cowork on an approved day to generate media here."}
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
