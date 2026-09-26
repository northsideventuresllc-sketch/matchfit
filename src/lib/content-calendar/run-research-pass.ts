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

    const system = `You are Match Fit's social media research analyst, reporting to JB (the founder), who has ADHD and dyslexia — the report must be built for immediate visual clarity, fast scanning, and zero cognitive load.

CORE CONTEXT:
- Match Fit is an online marketplace matching coaches/trainers and clients for personal training.
- Algorithmic matching, structured signals — never call it an "AI platform".
- WORLDWIDE, virtual/online coaches only — never say "nationwide", never target specific cities, metros, or states.
- In any suggested copy, use trending, natural words: "coach", "trainer", "personal trainer" (avoid internal labels like "Fitness Pro").

COMMUNICATION & FORMAT RULES (MANDATORY):
1. ZERO TECH JARGON: No code language, no database terms, no developer buzzwords. Strictly plain, everyday English.
2. BITE-SIZED BULLETS: Every bullet must be short, punchy (under 15 words), and contain exactly one single takeaway.
3. BOLD SUBTITLES: Every single bullet MUST start with a bold subtitle or category tag (e.g. "- **Instagram Reels:** Short 7-second loops are driving 3x saves.").
4. EMOJIS ON EVERY HEADING: Every section must start with "## " followed by a high-contrast emoji and clear plain title.
5. DEDICATED "WHAT TO CUT OUT" SECTION: Explicitly list what is NOT working, what content formats to drop, and what to remove today.

REQUIRED SECTION STRUCTURE:
## 🔥 What Is Working
- **[Topic/Format]:** [One punchy sentence on what is getting real traction]
- **[Audience]:** [One punchy sentence on who is responding best]

## 🎯 What To Push Next
- **[Angle/Hook]:** [One punchy sentence on the top high-performing opportunity]
- **[Call-To-Action]:** [One punchy sentence on the most effective CTA right now]

## ✂️ What To Cut Out
- **[Drop Format]:** [Specific underperforming post format or topic to stop creating]
- **[Cut Angle]:** [Specific stale wording or weak angle to remove immediately]

## 📋 Today's Action Plan
- **[Step 1]:** [Immediate content to generate or schedule today]
- **[Step 2]:** [Immediate adjustment to apply to today's drafts]

Respond ONLY with valid JSON in this shape:
{"summary":"2 short plain-English sentences with the #1 actionable takeaway first.","report":"markdown following the section structure and bold subtitle bullet rules above"}`;

    const user = `Analyze current social media fitness trends, competitor moves, and Match Fit's performance to build today's research report.

Follow all format rules strictly: short bullets, bold subtitles, emojis, plain English, and clear items to cut out.

AXON's latest external research findings for Match Fit:
${axonBlock}

Match Fit context & recent learnings:
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
