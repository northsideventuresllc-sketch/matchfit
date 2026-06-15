import "server-only";

import { createNiBrainClient, isNiBrainConfigured } from "@/lib/ni-brain-client";
import type { OutreachPlatform } from "@/lib/outreach-types";

export type OutreachNiBrainSignalType =
  | "EDIT_DIFF"
  | "DELETE_REASON"
  | "SAVED_TO_HUB"
  | "DEAD_LEAD_PATTERN"
  | "REGENERATE_FEEDBACK";

export async function recordOutreachNiBrainLearning(args: {
  signalType: OutreachNiBrainSignalType;
  platform?: OutreachPlatform;
  leadId?: string;
  adminId?: string;
  originalText?: string;
  editedText?: string;
  meta?: Record<string, unknown>;
}): Promise<void> {
  if (!isNiBrainConfigured()) return;
  try {
    const client = createNiBrainClient();
    await client.from("match_fit_outreach_learning_signals").insert({
      signal_type: args.signalType,
      platform: args.platform ?? null,
      lead_id: args.leadId ?? null,
      admin_id: args.adminId ?? null,
      original_text: args.originalText?.slice(0, 8000) ?? null,
      edited_text: args.editedText?.slice(0, 8000) ?? null,
      meta_json: args.meta ?? null,
    });

    if (args.signalType === "DELETE_REASON" && args.editedText) {
      await client.from("Learnings").insert({
        learning: `Match Fit outreach delete (${args.platform ?? "unknown"}): ${truncate(args.editedText, 240)}`,
        source: "match fit outreach hq",
        date: new Date().toISOString(),
      });
    }
    if (args.signalType === "DEAD_LEAD_PATTERN" && args.editedText) {
      await client.from("Learnings").insert({
        learning: `Match Fit dead lead pattern (${args.platform ?? "unknown"}): ${truncate(args.editedText, 240)}`,
        source: "match fit outreach hq",
        date: new Date().toISOString(),
      });
    }
    if (args.signalType === "SAVED_TO_HUB" && args.editedText) {
      await client.from("Learnings").insert({
        learning: `Match Fit saved lead profile (${args.platform ?? "unknown"}): ${truncate(args.editedText, 240)}`,
        source: "match fit outreach hq",
        date: new Date().toISOString(),
      });
    }
  } catch (e) {
    console.warn("[outreach-ni-brain-learning] Could not record signal:", e);
  }
}

export async function fetchRecentOutreachNiBrainLearnings(
  adminId: string,
  limit = 10,
): Promise<string[]> {
  if (!isNiBrainConfigured()) return [];
  try {
    const client = createNiBrainClient();
    const { data: signals } = await client
      .from("match_fit_outreach_learning_signals")
      .select("signal_type, edited_text, meta_json, platform")
      .eq("admin_id", adminId)
      .order("created_at", { ascending: false })
      .limit(limit);

    const lines: string[] = [];
    for (const row of signals ?? []) {
      if (row.signal_type === "EDIT_DIFF" && row.edited_text) {
        const field = (row.meta_json as { field?: string } | null)?.field ?? "copy";
        lines.push(`Operator prefers ${field} tone like: "${truncate(row.edited_text, 140)}"`);
      }
      if (row.signal_type === "DELETE_REASON" && row.edited_text) {
        lines.push(`Avoid leads like this — deleted because: ${truncate(row.edited_text, 160)}`);
      }
      if (row.signal_type === "SAVED_TO_HUB" && row.edited_text) {
        lines.push(`Good lead profile pattern: ${truncate(row.edited_text, 160)}`);
      }
      if (row.signal_type === "DEAD_LEAD_PATTERN" && row.edited_text) {
        lines.push(`Dead lead warning pattern: ${truncate(row.edited_text, 160)}`);
      }
      if (row.signal_type === "REGENERATE_FEEDBACK" && row.edited_text) {
        const field = (row.meta_json as { field?: string } | null)?.field ?? "copy";
        lines.push(`Regenerate feedback for ${field}: ${truncate(row.edited_text, 160)}`);
      }
    }
    return lines.slice(0, 12);
  } catch (e) {
    console.warn("[outreach-ni-brain-learning] Could not fetch learnings:", e);
    return [];
  }
}

function truncate(s: string, max: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}
