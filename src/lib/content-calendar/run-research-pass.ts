import "server-only";

import { callMatchFitAi } from "@/lib/ai-vault";
import { buildContentGenerationContext } from "@/lib/content-calendar/content-context";
import {
  completeResearchRun,
  createRunningResearchRun,
  failResearchRun,
  fetchRecentAxonMatchFitFindings,
  serializeResearchRun,
  type ClientContentResearchRun,
  type ContentResearchRunRow,
  type ContentResearchRunTrigger,
} from "@/lib/content-calendar/content-research-store";
import { currentEtCalendarDate } from "@/lib/content-calendar/pending-schedule";
import { createNiBrainClient } from "@/lib/ni-brain-client";

type TodaysPostRow = {
  post_type: string;
  target_group: string;
  caption: string;
  workflow_stage: string | null;
};

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

function summarizeTodaysPosts(posts: TodaysPostRow[]): string {
  if (!posts.length) return "No posts have been generated or approved yet today.";
  return posts
    .map((p) => `- ${p.post_type} → ${p.target_group} (${p.workflow_stage ?? "hub"}): ${p.caption.slice(0, 160)}`)
    .join("\n");
}

/** Strip a JSON envelope {summary, report} out of an AI response defensively (code-fence tolerant). */
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

/**
 * Runs one Social Media Research pass for Match Fit and records it. Shared by the manual "Run" button
 * (trigger "manual") and the daily cron (trigger "scheduled"). Folds AXON's daily competitor/trend
 * findings (from NI-Brain Decisions) into the prompt so the in-app report reflects AXON's research
 * — and the panel shows those findings alongside. Always via the AI Vault chain, never a provider API.
 */
export async function runContentResearchPass(args: {
  adminId: string | null;
  trigger: ContentResearchRunTrigger;
}): Promise<ClientContentResearchRun> {
  let run: ContentResearchRunRow | null = null;
  try {
    run = await createRunningResearchRun({ adminId: args.adminId, trigger: args.trigger });

    const today = currentEtCalendarDate();
    const [context, todaysPosts, axonFindings] = await Promise.all([
      buildContentGenerationContext(),
      fetchTodaysPosts(today),
      fetchRecentAxonMatchFitFindings(5),
    ]);

    const axonBlock = axonFindings.length
      ? axonFindings.map((f) => `- ${f.text}`).join("\n")
      : "No AXON research findings for Match Fit in the last few days.";

    const system = `You are Match Fit's social media research analyst, reporting to JB (the founder).
Match Fit is an online marketplace matching coaches/trainers and clients for personal training — algorithmic matching, structured signals, never described as an "AI platform". WORLDWIDE, virtual/online coaches only — never "nationwide", no city, metro or geo targeting anywhere.
In any suggested copy, lead with trending, widely-understood words — "coach", "trainer", "personal trainer" — not our internal "Fitness Pro" term.
Plain English, short sentences, no fluff, no vague generalities — every claim should point at something concrete from the context you're given.
Respond ONLY with JSON: {"summary":"2-4 sentence plain-English summary of the whole report","report":"the full report in markdown, with clear section headings"}`;

    const user = `Research and report on:
1. General fitness-content trends right now, and how Match Fit should apply them.
2. Match Fit's own recent content and performance — use the live context below, never invent numbers.
3. What is working and what needs work, and why.
4. Which parts of Match Fit (features, promos, audiences) to push harder right now, and why.
5. How today's generated/approved posts already reflect this research, or where they miss it.
6. The plan of action for today's social run — concretely, what to generate or adjust next.

AXON's latest external research findings for Match Fit (competitor + trend research — weave these in):
${axonBlock}

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
    return serializeResearchRun(completed);
  } catch (e) {
    if (run) {
      await failResearchRun({
        id: run.id,
        error: e instanceof Error ? e.message : "Could not run social media research.",
      }).catch(() => {});
    }
    throw e;
  }
}
