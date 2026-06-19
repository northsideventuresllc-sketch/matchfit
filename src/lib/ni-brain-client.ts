import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ContentCalendarPostType } from "@/lib/content-calendar/constants";

export type ContentCalendarPostRow = {
  id: string;
  week_start: string;
  post_date: string;
  day_index: number;
  post_type: ContentCalendarPostType;
  target_group: string;
  platforms: string;
  caption: string;
  visual_prompt: string | null;
  hashtags: string[] | null;
  media_url: string | null;
  media_status: "none" | "generating" | "ready" | "failed";
  posted: boolean;
  posted_at: string | null;
  missed_prompt_dismissed: boolean;
  saved_to_hub_at: string | null;
  is_scheduled: boolean;
  purge_after_at: string | null;
  bulk_session_id: string | null;
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
    if (row.signal_type === "WEBSITE_SCAN" && row.edited_text) {
      lines.push(`Website/promo scan: ${truncate(row.edited_text, 180)}`);
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
    | "WEBSITE_SCAN"
    | "MEDIA_GENERATED";
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

function truncate(s: string, max: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}
