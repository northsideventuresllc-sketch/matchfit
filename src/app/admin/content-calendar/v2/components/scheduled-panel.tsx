"use client";

import {
  adminCardClass,
  adminAccentButtonClass,
  adminSecondaryButtonClass,
} from "@/components/admin/admin-portal-ui";
import type { ClientContentCalendarV2Post } from "@/lib/content-calendar/content-calendar-v2-store";
import { defaultPlatformsForPost, postTypeIcon } from "./helpers";

/**
 * Scheduled Posts. Two kinds of card live here:
 *  - Awaiting posting: a post the operator sent here via "Manually Post" — they post it themselves,
 *    then press POSTED to confirm it went live.
 *  - Posted: once confirmed it flips to Posted and stays here for 48h (posted_retain_until) before
 *    rolling into Archives. The operator can still change the status back, or send it to Publishing.
 */
function ScheduledCard({
  post,
  busy,
  onAction,
}: {
  post: ClientContentCalendarV2Post;
  busy: boolean;
  onAction: (id: string, body: Record<string, unknown>, success?: string) => Promise<void>;
}) {
  const platforms = defaultPlatformsForPost(post);
  const posted = post.posted;

  return (
    <article className="rounded-2xl border border-white/[0.08] bg-[#12151C]/90 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#FFD34E]">
            {postTypeIcon(post.postType)} {post.postType}
            {posted ? (
              <span className="ml-2 rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                POSTED
              </span>
            ) : (
              <span className="ml-2 text-white/40">Waiting for you to confirm</span>
            )}
          </p>
          <p className="mt-1 text-sm text-white/60">
            {post.theme || "Untitled"} · {post.targetGroup}
          </p>
          <p className="mt-2 text-xs text-white/45">
            {post.scheduledAt ? new Date(post.scheduledAt).toLocaleString() : "No time set"} ·{" "}
            {platforms.length ? platforms.join(", ") : "No places picked"}
          </p>
          {posted && post.postedAt ? (
            <p className="mt-1 text-[11px] text-emerald-300/80">
              Marked posted {new Date(post.postedAt).toLocaleString()} — stays here 48h.
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap gap-2 sm:flex-col sm:items-end">
          {posted ? (
            <button
              type="button"
              className={adminSecondaryButtonClass}
              disabled={busy}
              onClick={() => void onAction(post.id, { action: "mark_unposted" }, "Marked as not posted.")}
            >
              Mark Not Posted
            </button>
          ) : (
            <button
              type="button"
              className={adminAccentButtonClass}
              disabled={busy}
              onClick={() => void onAction(post.id, { action: "mark_posted" }, "Marked as posted.")}
            >
              POSTED
            </button>
          )}
          <button
            type="button"
            className={adminSecondaryButtonClass}
            disabled={busy}
            onClick={() =>
              void onAction(post.id, { action: "back_to_publishing" }, "Sent back to Publishing.")
            }
          >
            Back To Publishing
          </button>
        </div>
      </div>
    </article>
  );
}

export function ScheduledPanel({
  posts,
  busyId,
  onAction,
}: {
  posts: ClientContentCalendarV2Post[];
  busyId: string | null;
  onAction: (id: string, body: Record<string, unknown>, success?: string) => Promise<void>;
}) {
  return (
    <section className={adminCardClass}>
      <h2 className="text-lg font-black uppercase tracking-[0.12em] text-white">Scheduled Posts</h2>
      <p className="mt-1 text-sm leading-relaxed text-white/55">
        Posts you&apos;re posting yourself. Press POSTED once one is live — it stays here as Posted for 48 hours, then
        moves to Archives. You can change the status back, or send a post to Publishing.
      </p>

      <div className="mt-5 space-y-3">
        {posts.map((post) => (
          <ScheduledCard key={post.id} post={post} busy={busyId === post.id} onAction={onAction} />
        ))}
        {!posts.length ? (
          <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-10 text-center text-sm text-white/45">
            No scheduled posts yet.
          </div>
        ) : null}
      </div>
    </section>
  );
}
