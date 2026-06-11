#!/usr/bin/env node
/**
 * Server/script-side NI Brain client (Northside Intelligence Brain — kxijunwgbrlfzvgkhklo).
 * Uses NI_BRAIN_SUPABASE_URL + NI_BRAIN_SUPABASE_SERVICE_ROLE_KEY from env.
 */
import { createClient } from "@supabase/supabase-js";

export const MATCH_FIT_TOOL_SLUG = "match-fit";
export const NI_BRAIN_PROJECT_REF = "kxijunwgbrlfzvgkhklo";

const SECRET_PATTERNS = [
  /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
  /(?:api[_-]?key|secret|password|token|service[_-]?role)\s*[:=]\s*\S+/gi,
  /sk_(?:live|test)_[A-Za-z0-9]+/g,
  /postgresql:\/\/[^\s]+/gi,
];

export function truncateText(text, max) {
  const t = String(text).replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

export function sanitizeForNiBrain(text) {
  let out = String(text);
  for (const pattern of SECRET_PATTERNS) {
    out = out.replace(pattern, "[redacted]");
  }
  return out.trim();
}

export function isNiBrainConfigured() {
  return Boolean(
    process.env.NI_BRAIN_SUPABASE_URL?.trim() && process.env.NI_BRAIN_SUPABASE_SERVICE_ROLE_KEY?.trim(),
  );
}

export function assertNiBrainProjectRef() {
  const key = process.env.NI_BRAIN_SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  if (!key) return;
  try {
    const payload = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString("utf8"));
    if (payload.ref && payload.ref !== NI_BRAIN_PROJECT_REF) {
      throw new Error(
        `NI_BRAIN_SUPABASE_SERVICE_ROLE_KEY is for Supabase project "${payload.ref}", not NI Brain (${NI_BRAIN_PROJECT_REF}). ` +
          "Use the service_role key from Northside Intelligence Brain → Settings → API.",
      );
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes("NI_BRAIN_SUPABASE_SERVICE_ROLE_KEY")) {
      throw err;
    }
  }
}

export function createNiBrainScriptClient() {
  assertNiBrainProjectRef();
  const url = process.env.NI_BRAIN_SUPABASE_URL?.trim();
  const key = process.env.NI_BRAIN_SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error(
      "NI Brain is not configured. Set NI_BRAIN_SUPABASE_URL and NI_BRAIN_SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function recordNiBrainLearning(client, { learning, source }) {
  const { error } = await client.from("Learnings").insert({
    learning: truncateText(sanitizeForNiBrain(learning), 4000),
    source: truncateText(source, 200),
    date: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function recordNiBrainDecision(client, { decision, outcome }) {
  const { error } = await client.from("Decisions").insert({
    decision: truncateText(sanitizeForNiBrain(decision), 4000),
    outcome: outcome ? truncateText(sanitizeForNiBrain(outcome), 2000) : null,
    date: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function recordNiBrainBuildLog(client, { logType, summary, detail, weekOf }) {
  const week = weekOf ?? new Date().toISOString().slice(0, 10);
  const { error } = await client.from("arm3_weekly_logs").insert({
    week_of: week,
    log_type: logType,
    tool_slug: MATCH_FIT_TOOL_SLUG,
    summary: truncateText(sanitizeForNiBrain(summary), 500),
    detail: detail ?? null,
    action_required: false,
  });
  if (error) throw error;
}

export async function upsertMatchFitBuildContext(client, content) {
  const safe = sanitizeForNiBrain(content).slice(0, 120_000);
  const { data: existing } = await client
    .from("Context")
    .select("id")
    .ilike("content", "%MATCH FIT%BUILD CONTEXT%")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await client
      .from("Context")
      .update({ content: safe, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) throw error;
    return { action: "updated", id: existing.id };
  }

  const { data, error } = await client
    .from("Context")
    .insert({ content: safe, updated_at: new Date().toISOString() })
    .select("id")
    .single();
  if (error) throw error;
  return { action: "inserted", id: data.id };
}
