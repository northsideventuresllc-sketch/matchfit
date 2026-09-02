"use client";

import { adminCardClass } from "@/components/admin/admin-portal-ui";
import type { ClientContentCalendarV2Post } from "@/lib/content-calendar/content-calendar-v2-store";
import { defaultPlatformsForPost, postTypeIcon } from "./helpers";

/**
 * Read-only list of scheduled posts. The post row has no media-agent job-id column (a post joins a
 * post_batch job only when APPROVE FOR POSTING runs from Publishing), so the batch column shows the
 * pending state rather than a fabricated id.
 */
export function ScheduledPanel({ posts }: { posts: ClientContentCalendarV2Post[] }) {
  return (
    <section className={adminCardClass}>
      <h2 className="text-lg font-black uppercase tracking-[0.12em] text-white">Scheduled Posts</h2>
      <p className="mt-1 text-sm leading-relaxed text-white/55">
        Posts with a set date and time. They join a media agent post batch when approved for posting.
      </p>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-white/[0.08] text-[11px] uppercase tracking-wide text-white/45">
              <th className="py-2 pr-4 font-semibold">Post time</th>
              <th className="py-2 pr-4 font-semibold">Media agent batch</th>
              <th className="py-2 pr-4 font-semibold">Date</th>
              <th className="py-2 pr-4 font-semibold">Type</th>
              <th className="py-2 pr-4 font-semibold">Platforms</th>
            </tr>
          </thead>
          <tbody>
            {posts.map((post) => (
              <tr key={post.id} className="border-b border-white/[0.04] text-white/75">
                <td className="py-2.5 pr-4 font-semibold text-white">
                  {post.scheduledAt ? new Date(post.scheduledAt).toLocaleString() : "Not set"}
                </td>
                <td className="py-2.5 pr-4 text-white/45">Pending batch</td>
                <td className="py-2.5 pr-4">{post.postDate || "—"}</td>
                <td className="py-2.5 pr-4">
                  {postTypeIcon(post.postType)} {post.postType}
                </td>
                <td className="py-2.5 pr-4 text-white/60">{defaultPlatformsForPost(post).join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!posts.length ? (
          <div className="mt-4 rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-10 text-center text-sm text-white/45">
            No scheduled posts yet.
          </div>
        ) : null}
      </div>
    </section>
  );
}
