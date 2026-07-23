"use client";

import { useCallback, useEffect, useState } from "react";
import {
  adminCardClass,
  adminInputClassSm,
  adminLabelClass,
  adminPrimaryButtonClass,
} from "@/components/admin/admin-portal-ui";
import type { ClientContentCalendarV2Post } from "@/lib/content-calendar/content-calendar-v2-store";
import { formatRetentionCountdown, postTypeIcon } from "./helpers";

const POSTED_MAX_HOURS = 8760;
const SCRAPPED_MAX_DAYS = 365;

type Settings = {
  postedRetentionHours: number;
  scrappedRetentionDays: number;
  updatedAt: string | null;
  limits?: { postedRetentionMaxHours: number; scrappedRetentionMaxDays: number };
};

function ArchiveItem({ post }: { post: ClientContentCalendarV2Post }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#0E1016]/70 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-black uppercase tracking-[0.12em] text-[#FFD34E]">
          {postTypeIcon(post.postType)} {post.postType} · {post.postDate || "No date"}
        </p>
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white/55">
          {formatRetentionCountdown(post.purgeAfterAt)}
        </span>
      </div>
      <p className="mt-1 line-clamp-2 text-xs text-white/55">{post.caption}</p>
      {post.scrapReason ? <p className="mt-1 text-[11px] text-white/40">Reason: {post.scrapReason}</p> : null}
      {post.archiveType === "posted" && Object.keys(post.postedUrls).length ? (
        <div className="mt-1.5 flex flex-wrap gap-2">
          {Object.entries(post.postedUrls).map(([platform, url]) => (
            <a key={platform} href={url} target="_blank" rel="noreferrer" className="text-[11px] text-[#FF7E00] hover:underline">
              {platform} ↗
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ArchivesPanel({ posts }: { posts: ClientContentCalendarV2Post[] }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [postedHours, setPostedHours] = useState("");
  const [scrappedDays, setScrappedDays] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsNote, setSettingsNote] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/content-calendar/v2/settings", { credentials: "include" });
      const data = (await res.json().catch(() => ({}))) as { settings?: Settings; error?: string };
      if (!res.ok || !data.settings) throw new Error(data.error ?? "Could not load settings.");
      setSettings(data.settings);
      setPostedHours(String(data.settings.postedRetentionHours));
      setScrappedDays(String(data.settings.scrappedRetentionDays));
    } catch (e) {
      setSettingsError(e instanceof Error ? e.message : "Could not load settings.");
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void loadSettings());
  }, [loadSettings]);

  async function saveSettings() {
    setSettingsError(null);
    setSettingsNote(null);
    const hours = Number(postedHours);
    const days = Number(scrappedDays);
    if (!Number.isInteger(hours) || hours < 1 || hours > POSTED_MAX_HOURS) {
      setSettingsError(`Posted retention must be a whole number of hours between 1 and ${POSTED_MAX_HOURS}.`);
      return;
    }
    if (!Number.isInteger(days) || days < 1 || days > SCRAPPED_MAX_DAYS) {
      setSettingsError(`Scrapped retention must be a whole number of days between 1 and ${SCRAPPED_MAX_DAYS}.`);
      return;
    }
    setSavingSettings(true);
    try {
      const res = await fetch("/api/admin/content-calendar/v2/settings", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postedRetentionHours: hours, scrappedRetentionDays: days }),
      });
      const data = (await res.json().catch(() => ({}))) as { settings?: Settings; error?: string };
      if (!res.ok || !data.settings) throw new Error(data.error ?? "Could not update settings.");
      setSettings(data.settings);
      setSettingsNote("Retention settings saved.");
    } catch (e) {
      setSettingsError(e instanceof Error ? e.message : "Could not update settings.");
    } finally {
      setSavingSettings(false);
    }
  }

  const posted = posts.filter((p) => p.archiveType === "posted");
  const scrapped = posts.filter((p) => p.archiveType !== "posted");

  return (
    <div className="space-y-6">
      <section className={adminCardClass}>
        <h2 className="text-lg font-black uppercase tracking-[0.12em] text-white">Archives</h2>
        <p className="mt-1 text-sm leading-relaxed text-white/55">
          Posted and scrapped content, each showing its retention countdown before automatic purge.
        </p>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-300">Posted</p>
            <div className="mt-3 space-y-2">
              {posted.map((post) => (
                <ArchiveItem key={post.id} post={post} />
              ))}
              {!posted.length ? <p className="text-xs text-white/40">No posted archives in range.</p> : null}
            </div>
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#FFB4B4]">Scrapped</p>
            <div className="mt-3 space-y-2">
              {scrapped.map((post) => (
                <ArchiveItem key={post.id} post={post} />
              ))}
              {!scrapped.length ? <p className="text-xs text-white/40">No scrapped archives.</p> : null}
            </div>
          </div>
        </div>
      </section>

      <section className={adminCardClass}>
        <h3 className="text-sm font-black uppercase tracking-[0.14em] text-white">Retention settings</h3>
        <p className="mt-1 text-xs text-white/50">
          How long posted and scrapped content stay in Archives before automatic purge.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label>
            <span className={adminLabelClass}>Posted retention (hours, 1–{POSTED_MAX_HOURS})</span>
            <input
              type="number"
              min={1}
              max={POSTED_MAX_HOURS}
              className={`${adminInputClassSm} mt-1`}
              value={postedHours}
              onChange={(e) => setPostedHours(e.target.value)}
            />
          </label>
          <label>
            <span className={adminLabelClass}>Scrapped retention (days, 1–{SCRAPPED_MAX_DAYS})</span>
            <input
              type="number"
              min={1}
              max={SCRAPPED_MAX_DAYS}
              className={`${adminInputClassSm} mt-1`}
              value={scrappedDays}
              onChange={(e) => setScrappedDays(e.target.value)}
            />
          </label>
        </div>
        {settingsError ? <p className="mt-3 text-xs font-semibold text-[#FFB4B4]">{settingsError}</p> : null}
        {settingsNote ? <p className="mt-3 text-xs font-semibold text-emerald-300">{settingsNote}</p> : null}
        <div className="mt-4 flex items-center gap-3">
          <button type="button" className={adminPrimaryButtonClass} disabled={savingSettings} onClick={() => void saveSettings()}>
            {savingSettings ? "SAVING…" : "SAVE SETTINGS"}
          </button>
          {settings?.updatedAt ? (
            <span className="text-[11px] text-white/40">Updated {new Date(settings.updatedAt).toLocaleString()}</span>
          ) : null}
        </div>
      </section>
    </div>
  );
}
