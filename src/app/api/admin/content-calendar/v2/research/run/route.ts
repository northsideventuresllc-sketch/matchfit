import { NextResponse } from "next/server";
import { callMatchFitAi } from "@/lib/ai-vault";
import { buildContentGenerationContext } from "@/lib/content-calendar/content-context";
import {
  completeResearchRun,
  createRunningResearchRun,
  failResearchRun,
  serializeResearchRun,
  type ContentResearchRunRow,
} from "@/lib/content-calendar/content-research-store";
import { etWallClock } from "@/lib/content-calendar/pending-schedule";
import {
  ensureContentCalendarV23Schema,
  isMissingContentCalendarV23SchemaError,
} from "@/lib/ensure-content-hub-schema";
import { createNiBrainClient, isNiBrainConfiguredAsync } from "@/lib/ni-brain-client";
import { formatUserFacingError } from "@/lib/read-json-response";
import { requireAdminSession } from "@/lib/require-admin";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Today's America/New_York calendar date as YYYY-MM-DD — same reader content-research-store.ts uses internally. */
function currentEtCalendarDate(now: Date = new Date()): string {
  const wall = etWallClock(now);
  return `${wall.year}-${String(wall.month).padStart(2, "0")}-${String(wall.day).padStart(2, "0")}`;
}

type TodaysPostRow = {
  post_type: string;
  target_group: string;
  caption: string;
  workflow_stage: string | null;
};

/** Plain read of today's posts (any stage) so the research prompt can reference what already went out today. */
async function fetchTodaysPosts(postDate: string): Promise<TodaysPostRow[]> {
  const client = createNiBrainClient();
  const { data, error } = await client
    .from("match_fit_content_calendar_posts")
    .select("post_type, target_group, caption, workflow_stage")
    .eq("post_date", postDate)
    .is("deleted_at", null);
  if (error) throw new Error(error.message);
  return (data ?? []) as TodaysPostRow[];
}

/**
 * Same defensive JSON-extraction strategy as content-calendar-ai.ts's private parseJsonBlock
 * (strip code fences, try a direct parse, fall back to a brace-matched substring) — reimplemented
 * locally because that helper isn't exported and content-calendar-ai.ts is out of scope here.
 */
function parseResearchEnvelope(text: string): { summary: string; report: string } | null {
  const tryParse = (raw: string): { summary: string; report: string } | null => {
    try {
      const parsed = JSON.parse(raw) as { summary?: unknown; report?: unknown };
      if (typeof parsed.summary === "string" && typeof parsed.report === "string") {
        return { summary: parsed.summary, report: parsed.report };
      }
    } catch {
      // fall through
    }
    return null;
  };

  const cleaned = text.replace(/```json|```/g, "").trim();
  const direct = tryParse(cleaned);
  if (direct) return direct;

  const objectJson = text.match(/\{[\s\S]*\}/)?.[0];
  return objectJson ? tryParse(objectJson) : null;
}

function summarizeTodaysPosts(posts: TodaysPostRow[]): string {
  if (!posts.length) return "No posts have been generated or approved yet today.";
  return posts
    .map((p) => `- ${p.post_type} → ${p.target_group} (${p.workflow_stage ?? "hub"}): ${p.caption.slice(0, 160)}`)
    .join("\n");
}

/**
 * Runs one Social Media Research pass: general fitness-content trends, Match Fit's own recent
 * content/performance (via the same live-scan + learnings context content generation already
 * uses), what's working vs what needs work, which parts of Match Fit to push and why, and how
 * today's generated posts already used this research (or didn't). Always through callMatchFitAi
 * — never a provider API directly, per the AI Vault house rule.
 */
export async function POST() {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!(await isNiBrainConfiguredAsync())) {
    return NextResponse.json({ error: "NI Brain is not configured." }, { status: 503 });
  }

  let run: ContentResearchRunRow | null = null;
  try {
    await ensureContentCalendarV23Schema();
    run = await createRunningResearchRun({ adminId: sess.adminId });

    const today = currentEtCalendarDate();
    const [context, todaysPosts] = await Promise.all([buildContentGenerationContext(), fetchTodaysPosts(today)]);

    const system = `You are Match Fit's social media research analyst, reporting to JB (the founder).
Match Fit is an online marketplace matching Fitness Pros and clients for personal training — algorithmic matching, structured signals, never described as an "AI platform". Nationwide, virtual/online coaches only — no city, metro or geo targeting anywhere.
Plain English, short sentences, no fluff, no vague generalities — every claim should point at something concrete from the context you're given.
Respond ONLY with JSON: {"summary":"2-4 sentence plain-English summary of the whole report","report":"the full report in markdown, with clear section headings"}`;

    const user = `Research and report on:
1. General fitness-content trends right now, and how Match Fit should apply them.
2. Match Fit's own recent content and performance — use the live context below, never invent numbers.
3. What is working and what needs work, and why.
4. Which parts of Match Fit (features, promos, audiences) to push harder right now, and why.
5. How today's generated/approved posts already reflect this research, or where they miss it.

Match Fit context (live site/social scans, recent operator learnings, winning angles):
${context}

Today's posts (${today}):
${summarizeTodaysPosts(todaysPosts)}`;

    const aiResult = await callMatchFitAi({
      system,
      user,
      maxTokens: 4000,
      temperature: 0.5,
      jsonMode: true,
      timeoutMs: 60_000,
      kind: "research",
      // Contract precedent (content-calendar-ai.ts) only defines "simple" | "standard" | "complex" —
      // there is no "high" complexity value, so "complex" is the closest real one for a long report.
      complexity: "complex",
    });

    if (!aiResult.text) {
      throw new Error(aiResult.error ?? "All AI providers failed to produce a research report.");
    }

    const parsed = parseResearchEnvelope(aiResult.text);
    if (!parsed) {
      throw new Error("The AI returned a report, but it could not be read back as JSON.");
    }

    const completed = await completeResearchRun({
      id: run.id,
      summary: parsed.summary,
      reportBody: parsed.report,
      model: aiResult.model,
    });
    return NextResponse.json({ run: serializeResearchRun(completed) });
  } catch (e) {
    console.error("[content-calendar v2 research run]", e);
    const message = formatUserFacingError(e, "Could not run social media research.");
    if (run) {
      await failResearchRun({ id: run.id, error: message }).catch((failErr) => {
        console.error("[content-calendar v2 research run] failResearchRun also failed:", failErr);
      });
    }
    return NextResponse.json(
      { error: message },
      { status: isMissingContentCalendarV23SchemaError(e) ? 503 : 500 },
    );
  }
}
