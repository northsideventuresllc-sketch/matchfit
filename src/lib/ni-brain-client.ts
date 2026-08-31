import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ContentCalendarPostType } from "@/lib/content-calendar/constants";

export type ContentCalendarPostRow = {
  id: string;
  week_start: string;
  post_date: string | null;
  day_index: number;
  post_type: ContentCalendarPostType;
  target_group: string;
  platforms: string;
  status: string | null;
  caption: string;
  visual_prompt: string | null;
  hashtags: string[] | null;
  media_url: string | null;
  media_urls: string[] | null;
  media_status: "none" | "generating" | "ready" | "failed";
  posted: boolean;
  posted_at: string | null;
  approved_at: string | null;
  scheduled_at: string | null;
  missed_prompt_dismissed: boolean;
  saved_to_hub_at: string | null;
  is_scheduled: boolean;
  theme: string | null;
  cta: string | null;
  content_lane: "scheduled" | "impromptu" | null;
  workflow_stage: "hub" | "pending" | "publishing" | "scheduled" | "archived" | null;
  /** Exact prompt last sent for this post's media generation (Cowork job or manual regenerate). */
  last_generation_prompt: string | null;
  /** Stamped when a post enters "pending" (agent path) or fireCoworkForPost fires (manual regenerate). */
  media_generation_started_at: string | null;
  /** Where the post's current media came from — null until it has been generated or replaced once. */
  generation_source: "cowork_gemini" | "manual_upload" | null;
  platform_captions: Record<string, string> | null;
  platform_hashtags: Record<string, string[]> | null;
  optimize_status: "idle" | "running" | "done" | "failed" | null;
  optimize_error: string | null;
  optimize_started_at: string | null;
  dpmo_phase: string | null;
  dpmo_rationale: string | null;
  social_scan_snapshot_id: string | null;
  hashtag_research_snapshot: Record<string, unknown> | null;
  archived_at: string | null;
  archive_type: "posted" | "scrapped" | null;
  scrap_reason: string | null;
  posted_urls: Record<string, string> | null;
  /** '5pm' | '8pm' — the nightly posting slot. Posting runs select strictly on this, so NULL never posts. */
  post_group: "5pm" | "8pm" | null;
  purge_after_at: string | null;
  bulk_session_id: string | null;
  deleted_at: string | null;
  /** Bumped whenever a post is edited or pulled back a stage. NOT NULL in Postgres, default 1. */
  revision?: number;
  created_at: string;
  updated_at: string;
  admin_id: string | null;
};

export function isNiBrainConfigured(): boolean {
  return Boolean(
    process.env.NI_BRAIN_SUPABASE_URL?.trim() && process.env.NI_BRAIN_SUPABASE_SERVICE_ROLE_KEY?.trim(),
  );
}

/** Loads NI Brain keys from platform_secrets when Vercel env is unset. */
export async function ensureNiBrainEnvHydrated(): Promise<void> {
  const { hydratePlatformEnvFromDatabase } = await import("@/lib/hydrate-platform-env");
  await hydratePlatformEnvFromDatabase();
}

export async function isNiBrainConfiguredAsync(): Promise<boolean> {
  await ensureNiBrainEnvHydrated();
  return isNiBrainConfigured();
}

/** Server-only NI Brain (Northside Intelligence) Supabase client — project kxijunwgbrlfzvgkhklo. */
export function createNiBrainClient(): SupabaseClient {
  const url = process.env.NI_BRAIN_SUPABASE_URL?.trim();
  const key = process.env.NI_BRAIN_SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error(
      "NI Brain is not configured. Set NI_BRAIN_SUPABASE_URL and NI_BRAIN_SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function fetchNiBrainMatchFitContext(): Promise<string> {
  if (!isNiBrainConfigured()) return "";
  const client = createNiBrainClient();
  const { data } = await client
    .from("Context")
    .select("content")
    .ilike("content", "%MATCH FIT%")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.content?.trim() ?? "";
}

export async function fetchRecentContentLearnings(limit = 8): Promise<string[]> {
  if (!isNiBrainConfigured()) return [];
  const client = createNiBrainClient();
  const { data: signals } = await client
    .from("match_fit_content_learning_signals")
    .select("original_text, edited_text, meta_json, signal_type, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  const { data: learnings } = await client
    .from("Learnings")
    .select("learning, source, date")
    .ilike("source", "%match fit content%")
    .order("date", { ascending: false })
    .limit(5);

  const lines: string[] = [];

  for (const row of signals ?? []) {
    if (row.signal_type === "EDIT_DIFF" && row.edited_text) {
      const field = (row.meta_json as { field?: string } | null)?.field ?? "caption";
      lines.push(`Operator prefers ${field} tone like: "${truncate(row.edited_text, 140)}"`);
    }
    if (row.signal_type === "SOCIAL_SCAN" && row.edited_text) {
      lines.push(`Social insight: ${truncate(row.edited_text, 180)}`);
    }
  }

  for (const l of learnings ?? []) {
    lines.push(`[${l.source}] ${truncate(l.learning, 200)}`);
  }

  return lines.slice(0, 12);
}

export async function recordContentLearning(args: {
  signalType:
    | "EDIT_DIFF"
    | "POSTED"
    | "HASHTAG_RESEARCH"
    | "SOCIAL_SCAN"
    | "MEDIA_GENERATED"
    | "WEBSITE_SCAN"
    | "DAY_APPROVAL_MEMO";
  postId?: string;
  originalText?: string;
  editedText?: string;
  meta?: Record<string, unknown>;
}): Promise<void> {
  if (!isNiBrainConfigured()) return;
  const client = createNiBrainClient();
  await client.from("match_fit_content_learning_signals").insert({
    signal_type: args.signalType,
    post_id: args.postId ?? null,
    original_text: args.originalText?.slice(0, 8000) ?? null,
    edited_text: args.editedText?.slice(0, 8000) ?? null,
    meta_json: args.meta ?? null,
  });

  if (args.signalType === "EDIT_DIFF" && args.editedText && args.originalText) {
    if (args.originalText.trim() !== args.editedText.trim()) {
      await client.from("Learnings").insert({
        learning: `Match Fit content edit (${(args.meta?.field as string) ?? "caption"}): prefer "${truncate(args.editedText, 120)}" over "${truncate(args.originalText, 80)}".`,
        source: "match fit content calendar",
        date: new Date().toISOString(),
      });
    }
  }
}

/**
 * Writes a "pending" learning-signal memo to NI Brain when a content day is approved. The memo is
 * cancelable (via cancelDayApprovalMemo) until the day is fired to Cowork. Returns the inserted
 * signal id when NI Brain is configured, else null.
 */
export async function recordDayApprovalMemo(args: {
  postDate: string;
  summary: string;
  meta?: Record<string, unknown>;
}): Promise<{ id: string | null }> {
  if (!isNiBrainConfigured()) return { id: null };
  const client = createNiBrainClient();
  const { data, error } = await client
    .from("match_fit_content_learning_signals")
    .insert({
      signal_type: "DAY_APPROVAL_MEMO",
      post_id: null,
      edited_text: args.summary.slice(0, 8000),
      meta_json: { ...(args.meta ?? {}), postDate: args.postDate, status: "pending" },
    })
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return { id: (data?.id as string | undefined) ?? null };
}

/** Deletes the still-pending day-approval memo for a date (Return to Editing). Returns count removed. */
export async function cancelDayApprovalMemo(postDate: string): Promise<number> {
  if (!isNiBrainConfigured()) return 0;
  const client = createNiBrainClient();
  const { data, error } = await client
    .from("match_fit_content_learning_signals")
    .delete()
    .eq("signal_type", "DAY_APPROVAL_MEMO")
    .eq("meta_json->>postDate", postDate)
    .eq("meta_json->>status", "pending")
    .select("id");
  if (error) throw new Error(error.message);
  return (data ?? []).length;
}

/**
 * Idempotency guards for the two day-level operator emails (content-calendar-cowork-orchestration.ts).
 * Both reuse match_fit_content_learning_signals the same way recordDayApprovalMemo/cancelDayApprovalMemo
 * do — a signal_type discriminator plus meta_json.postDate — rather than a new table, since these are
 * just "has this fired for this date" existence checks.
 */
const DAY_SCHEDULED_EMAIL_SIGNAL = "DAY_SCHEDULED_EMAIL";
const DAY_ALL_POSTED_EMAIL_SIGNAL = "DAY_ALL_POSTED_EMAIL";

async function hasDaySignalBeenSent(signalType: string, postDate: string): Promise<boolean> {
  if (!isNiBrainConfigured()) return false;
  const client = createNiBrainClient();
  const { data, error } = await client
    .from("match_fit_content_learning_signals")
    .select("id")
    .eq("signal_type", signalType)
    .eq("meta_json->>postDate", postDate)
    .limit(1);
  if (error) throw new Error(error.message);
  return (data ?? []).length > 0;
}

async function recordDaySignalSent(signalType: string, postDate: string): Promise<void> {
  if (!isNiBrainConfigured()) return;
  const client = createNiBrainClient();
  const { error } = await client.from("match_fit_content_learning_signals").insert({
    signal_type: signalType,
    post_id: null,
    meta_json: { postDate },
  });
  if (error) throw new Error(error.message);
}

/** True when the "day scheduled" email has already gone out for this date. */
export async function hasDayScheduledEmailBeenSent(postDate: string): Promise<boolean> {
  return hasDaySignalBeenSent(DAY_SCHEDULED_EMAIL_SIGNAL, postDate);
}

/** Marks the "day scheduled" email sent for this date so a retry never double-sends it. */
export async function recordDayScheduledEmailSent(postDate: string): Promise<void> {
  return recordDaySignalSent(DAY_SCHEDULED_EMAIL_SIGNAL, postDate);
}

/** True when the "day fully posted" email has already gone out for this date. */
export async function hasDayAllPostedEmailBeenSent(postDate: string): Promise<boolean> {
  return hasDaySignalBeenSent(DAY_ALL_POSTED_EMAIL_SIGNAL, postDate);
}

/** Marks the "day fully posted" email sent for this date so a retry never double-sends it. */
export async function recordDayAllPostedEmailSent(postDate: string): Promise<void> {
  return recordDaySignalSent(DAY_ALL_POSTED_EMAIL_SIGNAL, postDate);
}

function truncate(s: string, max: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}
