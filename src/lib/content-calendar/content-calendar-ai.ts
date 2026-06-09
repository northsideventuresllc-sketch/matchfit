import "server-only";

import { getAdminAiProviderStatus, getAdminAiProviderStatusAsync } from "@/lib/admin-analytics-ai";
import {
  CONTENT_CALENDAR_BRAND_FACTS,
  CONTENT_CALENDAR_DAYS_LONG,
  CONTENT_CALENDAR_PLATFORMS_BY_TYPE,
  type ContentCalendarGeneratorPostType,
  type ContentCalendarPostType,
} from "@/lib/content-calendar/constants";
import { getContentCalendarRotation } from "@/lib/content-calendar/rotation";
import {
  fetchNiBrainMatchFitContext,
  fetchRecentContentLearnings,
  recordContentLearning,
} from "@/lib/ni-brain-client";
import { MATCH_FIT_OFFICIAL_SOCIAL_LINKS } from "@/lib/match-fit-official-social";

export type GeneratedPostContent = {
  caption: string;
  visualPrompt: string | null;
  hashtags: string[];
  hook?: string;
};

export type GeneratedWeekPost = GeneratedPostContent & {
  dayIndex: number;
  postType: ContentCalendarPostType;
  targetGroup: string;
  platforms: string;
};

async function callAi(system: string, user: string, maxTokens = 2000): Promise<string | null> {
  const status = await getAdminAiProviderStatusAsync();
  if (!status.configured) return null;

  if (status.provider === "anthropic") {
    const key = process.env.ANTHROPIC_API_KEY?.trim();
    if (!key) return null;
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: status.model ?? "claude-sonnet-4-20250514",
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: user }],
        temperature: 0.55,
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { content?: { type: string; text?: string }[] };
    return data.content?.find((b) => b.type === "text")?.text ?? null;
  }

  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_ADMIN_ANALYTICS_MODEL?.trim() || "gpt-4o-mini",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.55,
      max_tokens: maxTokens,
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content ?? null;
}

function parseJsonBlock<T>(text: string): T | null {
  try {
    const cleaned = text.replace(/```json|```/g, "").trim();
    return JSON.parse(cleaned) as T;
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as T;
    } catch {
      return null;
    }
  }
}

async function buildLearningContext(): Promise<string> {
  const [niContext, learnings] = await Promise.all([
    fetchNiBrainMatchFitContext(),
    fetchRecentContentLearnings(),
  ]);
  const socialUrls = MATCH_FIT_OFFICIAL_SOCIAL_LINKS.map((l) => `${l.label}: ${l.href}`).join("\n");
  return [
    niContext ? `NI Brain context:\n${niContext.slice(0, 1500)}` : "",
    learnings.length ? `Recent operator learnings:\n${learnings.join("\n")}` : "",
    `Official social profiles:\n${socialUrls}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export async function researchHashtagsForDate(args: {
  postDate: string;
  postType: ContentCalendarPostType;
  targetGroup: string;
}): Promise<string[]> {
  const today = args.postDate;
  const system = `You are a social media hashtag researcher for Match Fit (Atlanta fitness marketplace).
${CONTENT_CALENDAR_BRAND_FACTS}
Return ONLY JSON: {"hashtags":["tag1","tag2",...]} with 6-10 tags mixing broad fitness, Atlanta/local, and niche tags trending around ${today}. No # prefix in array values.`;
  const user = `Research best hashtags for ${args.postType} post targeting ${args.targetGroup} to publish on ${today} (Facebook/Threads/Instagram). Consider day-of-week fitness content trends.`;
  const text = await callAi(system, user, 600);
  const parsed = text ? parseJsonBlock<{ hashtags?: string[] }>(text) : null;
  const tags = (parsed?.hashtags ?? []).map((t) => t.replace(/^#/, "").trim()).filter(Boolean);
  if (tags.length) {
    await recordContentLearning({
      signalType: "HASHTAG_RESEARCH",
      editedText: tags.map((t) => `#${t}`).join(" "),
      meta: { postDate: args.postDate, postType: args.postType, targetGroup: args.targetGroup },
    });
  }
  return tags.length ? tags : ["MatchFit", "AtlantaFitness", "PersonalTrainer", "FitnessApp", "BetaLaunch"];
}

export async function regenerateCalendarPost(args: {
  weekStart: string;
  offset: number;
  dayIndex: number;
  postType: ContentCalendarPostType;
  feedback?: string;
  existingCaption?: string;
  existingVisualPrompt?: string | null;
}): Promise<GeneratedWeekPost | null> {
  const learning = await buildLearningContext();
  const rot = getContentCalendarRotation(args.dayIndex, args.offset);
  const targetGroup = rot[args.postType];
  const platforms = CONTENT_CALENDAR_PLATFORMS_BY_TYPE[args.postType];
  const system = `You are Match Fit's content calendar AI.
${CONTENT_CALENDAR_BRAND_FACTS}
${learning}
Respond ONLY with JSON: {"caption":"","visualPrompt":null,"hashtags":["tag1"]}
visualPrompt null only for Text posts.`;
  const user = `Regenerate ${CONTENT_CALENDAR_DAYS_LONG[args.dayIndex]} ${args.postType} for ${targetGroup} (week ${args.weekStart}).
Platforms: ${platforms}.
${args.existingCaption ? `Previous caption:\n${args.existingCaption}` : ""}
${args.existingVisualPrompt ? `Previous visual prompt:\n${args.existingVisualPrompt}` : ""}
${args.feedback ? `Operator feedback — apply these changes:\n${args.feedback}` : "Improve hook, clarity, and hashtags while keeping the same intent."}`;
  const text = await callAi(system, user, 2500);
  const parsed = text ? parseJsonBlock<{ caption?: string; visualPrompt?: string | null; hashtags?: string[] }>(text) : null;
  if (!parsed) return null;
  return {
    dayIndex: args.dayIndex,
    postType: args.postType,
    targetGroup,
    platforms,
    caption: parsed.caption ?? "",
    visualPrompt: args.postType === "Text" ? null : (parsed.visualPrompt ?? ""),
    hashtags: (parsed.hashtags ?? []).map((h) => String(h).replace(/^#/, "")),
  };
}

export async function generateSinglePost(args: {
  postType?: ContentCalendarGeneratorPostType;
  platform?: string;
  contentType: string;
  tone: string;
  customNote?: string;
}): Promise<{ hook: string; body: string; cta: string; hashtags: string[]; dmScript?: string } | null> {
  const learning = await buildLearningContext();
  const system = `You are a social media strategist for Match Fit.
${CONTENT_CALENDAR_BRAND_FACTS}
${learning}
Generate authentic content — scroll-stopping hook, core message, CTA, platform hashtags.
Respond ONLY with JSON: {"hook":"","body":"","cta":"","hashtags":["tag1"],"dmScript":""}`;
  const platformLabel =
    args.postType
      ? CONTENT_CALENDAR_PLATFORMS_BY_TYPE[args.postType]
      : (args.platform ?? "Instagram");
  const user = `Generate a ${args.tone} ${args.contentType} ${args.postType ? `${args.postType} ` : ""}post for ${platformLabel}.
${args.customNote ? `Prompt: ${args.customNote}` : ""}
Target: Atlanta trainers and clients. Goal: match-fit.net signups.`;
  const text = await callAi(system, user);
  return text ? parseJsonBlock(text) : null;
}

export async function generateWeekContent(args: {
  weekStart: string;
  offset: number;
}): Promise<GeneratedWeekPost[]> {
  const learning = await buildLearningContext();
  const rotationPlan = [0, 1, 2, 3, 4]
    .map((di) => {
      const rot = getContentCalendarRotation(di, args.offset);
      return `${CONTENT_CALENDAR_DAYS_LONG[di]}: ${Object.entries(rot)
        .map(([t, g]) => `${t}→${g}`)
        .join(", ")}`;
    })
    .join("\n");

  const system = `You are Match Fit's weekly content calendar AI.
${CONTENT_CALENDAR_BRAND_FACTS}
${learning}

Rotation for this week (M-F, keep exactly):
${rotationPlan}

Platform mapping: Carousel/Static→Instagram+Facebook captions+visual prompts; Video→Reels/TikTok with cinematic or UGC visual prompts; Text→Threads+Facebook (caption only, visualPrompt null).

Respond ONLY with JSON array of 20 objects (5 days × 4 types):
[{"dayIndex":0,"postType":"Text","caption":"...","visualPrompt":null,"hashtags":["MatchFit"]}]
dayIndex 0=Mon..4=Fri. postType one of Carousel|Static|Video|Text.`;

  const user = `Generate a full M-F content week starting ${args.weekStart}. Include day-of-week variety, Atlanta beta urgency, Fit Hub mentions where natural. Hashtags without # in array.`;

  const text = await callAi(system, user, 8000);
  const parsed = text ? parseJsonBlock<GeneratedWeekPost[]>(text) : null;
  if (!parsed || !Array.isArray(parsed)) return fallbackWeek(args.offset);

  return parsed.map((row) => {
    const postType = row.postType as ContentCalendarPostType;
    const rot = getContentCalendarRotation(row.dayIndex, args.offset);
    return {
      dayIndex: row.dayIndex,
      postType,
      targetGroup: rot[postType],
      platforms: CONTENT_CALENDAR_PLATFORMS_BY_TYPE[postType],
      caption: row.caption ?? "",
      visualPrompt: postType === "Text" ? null : (row.visualPrompt ?? ""),
      hashtags: (row.hashtags ?? []).map((h) => String(h).replace(/^#/, "")),
    };
  });
}

function fallbackWeek(offset: number): GeneratedWeekPost[] {
  const posts: GeneratedWeekPost[] = [];
  for (let di = 0; di < 5; di++) {
    const rot = getContentCalendarRotation(di, offset);
    for (const postType of ["Text", "Video", "Carousel", "Static"] as ContentCalendarPostType[]) {
      posts.push({
        dayIndex: di,
        postType,
        targetGroup: rot[postType],
        platforms: CONTENT_CALENDAR_PLATFORMS_BY_TYPE[postType],
        caption: `${CONTENT_CALENDAR_DAYS_LONG[di]} ${postType} for ${rot[postType]} — Match Fit beta in Atlanta. match-fit.net`,
        visualPrompt: postType === "Text" ? null : `Dark #07080C background, orange #FF7E00 accents. ${postType} for ${rot[postType]}.`,
        hashtags: ["MatchFit", "AtlantaFitness", "PersonalTrainer"],
      });
    }
  }
  return posts;
}

export async function analyzeSocialPerformance(): Promise<string> {
  const learning = await buildLearningContext();
  const system = `You analyze Match Fit social media performance for an operator dashboard.
${CONTENT_CALENDAR_BRAND_FACTS}
Be concise. Bullet what's working, what's not, and 3 specific improvements for next week's calendar.`;
  const user = `${learning}

Based on official profiles, operator edit patterns, and fitness marketplace best practices, summarize what's likely working vs underperforming for @theofficialmatchfit on Instagram, TikTok, Facebook, and Threads. Note content types (video, carousel, static, text) and Atlanta trainer recruitment focus.`;

  const text = await callAi(system, user, 1200);
  const summary = text ?? "Connect ANTHROPIC_API_KEY or OPENAI_API_KEY to run social performance analysis.";

  await recordContentLearning({
    signalType: "SOCIAL_SCAN",
    editedText: summary.slice(0, 4000),
    meta: { scannedAt: new Date().toISOString() },
  });

  return summary;
}

export async function generateStaticMedia(prompt: string): Promise<{ url: string } | null> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;

  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "dall-e-3",
      prompt: `Match Fit fitness brand social graphic. Dark background #07080C, orange accent #FF7E00. ${prompt}`.slice(
        0,
        3900,
      ),
      n: 1,
      size: "1024x1024",
      response_format: "url",
    }),
  });

  if (!res.ok) return null;
  const data = (await res.json()) as { data?: { url?: string }[] };
  const url = data.data?.[0]?.url;
  return url ? { url } : null;
}

export async function getContentCalendarAiStatusAsync(): Promise<{
  configured: boolean;
  niBrain: boolean;
  media: boolean;
  message: string;
}> {
  const { hydratePlatformEnvFromDatabase } = await import("@/lib/hydrate-platform-env");
  await hydratePlatformEnvFromDatabase();
  return getContentCalendarAiStatus();
}

export function getContentCalendarAiStatus(): { configured: boolean; niBrain: boolean; media: boolean; message: string } {
  const ai = getAdminAiProviderStatus();
  const niBrain = Boolean(
    process.env.NI_BRAIN_SUPABASE_URL?.trim() && process.env.NI_BRAIN_SUPABASE_SERVICE_ROLE_KEY?.trim(),
  );
  const media = Boolean(process.env.OPENAI_API_KEY?.trim());
  const parts: string[] = [];
  if (!ai.configured) parts.push("Add ANTHROPIC_API_KEY or OPENAI_API_KEY for generation.");
  if (!niBrain) parts.push("Add NI Brain Supabase keys (Vercel env or platform_secrets) for learning persistence.");
  if (!media) parts.push("Add OPENAI_API_KEY for static image generation.");
  return {
    configured: ai.configured,
    niBrain,
    media,
    message: parts.length ? parts.join(" ") : "Content calendar AI ready.",
  };
}
