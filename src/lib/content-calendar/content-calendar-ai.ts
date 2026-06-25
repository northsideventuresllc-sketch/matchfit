import "server-only";

import { getAiVaultStatus } from "@/lib/ai-vault";
import { callMatchFitAi } from "@/lib/ai-vault/router";
import { resolveGeminiModel } from "@/lib/ai-vault/models";
import {
  CONTENT_CALENDAR_BRAND_FACTS,
  CONTENT_CALENDAR_DAYS_LONG,
  CONTENT_CALENDAR_GROUPS,
  CONTENT_CALENDAR_PLATFORMS_BY_TYPE,
  type ContentCalendarGeneratorPostType,
  type ContentCalendarPostType,
} from "@/lib/content-calendar/constants";
import { buildContentGenerationContext } from "@/lib/content-calendar/content-context";
import {
  buildBulkSlotBrief,
  buildOperatorCreativeDirective,
  CONTENT_CALENDAR_CREATIVE_QUALITY_RULES,
  extractSlotDirectiveFromOperatorPrompt,
  isLazyCalendarDraft,
  normalizeGeneratedVisualPrompt,
  trimContextBlockForPrompt,
} from "@/lib/content-calendar/content-prompts";
import {
  CONTENT_CALENDAR_AI_RULES,
  CONTENT_CALENDAR_MAX_HASHTAGS,
  enforceGeneratedPostContent,
  normalizeFitnessProLanguage,
  normalizeHashtags,
  normalizeTargetGroup,
} from "@/lib/content-calendar/content-rules";
import { scanAndRecordSocialProfiles } from "@/lib/content-calendar/social-profile-scan";
import { addWeekdays, formatCalendarDate, getContentCalendarRotation } from "@/lib/content-calendar/rotation";
import {
  parseGeneratedPostArrayPayload,
  parseGeneratedPostPayload,
} from "@/lib/content-calendar/content-calendar-parse";
import { recordContentLearning } from "@/lib/ni-brain-client";

const CONTENT_CALENDAR_AI_TIMEOUT_MS = 45_000;

type CallAiResult = {
  text: string | null;
  error?: string;
  usedFallback?: boolean;
  provider?: string;
};

let lastContentCalendarAiError: string | null = null;
let contentCalendarGeminiFallbackUsed = false;

export function getLastContentCalendarAiError(): string | null {
  return lastContentCalendarAiError;
}

export function resetLastContentCalendarAiError(): void {
  lastContentCalendarAiError = null;
}

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

export type BulkGeneratedDraft = GeneratedPostContent & {
  tempId: string;
  postType: ContentCalendarPostType;
  targetGroup: string;
  platforms: string;
  postDate: string | null;
  dayIndex: number;
};

function applyPostRules(content: GeneratedPostContent, postType: ContentCalendarPostType): GeneratedPostContent {
  const enforced = enforceGeneratedPostContent({
    caption: content.caption,
    hashtags: content.hashtags,
  });
  return {
    ...content,
    caption: enforced.caption,
    hashtags: enforced.hashtags,
    visualPrompt:
      postType === "Text"
        ? null
        : content.visualPrompt
          ? normalizeFitnessProLanguage(content.visualPrompt)
          : content.visualPrompt,
  };
}

async function callAi(system: string, user: string, maxTokens = 2000, temperature = 0.55): Promise<CallAiResult> {
  const combinedLen = system.length + user.length;
  const result = await callMatchFitAi({
    system,
    user,
    maxTokens,
    temperature,
    jsonMode: true,
    timeoutMs: CONTENT_CALENDAR_AI_TIMEOUT_MS,
    kind: combinedLen > 7000 ? "creative" : "json",
    complexity: maxTokens >= 6000 ? "complex" : undefined,
  });

  if (result.text) {
    lastContentCalendarAiError = null;
    if (result.usedFallback) contentCalendarGeminiFallbackUsed = true;
    return {
      text: result.text,
      provider: result.provider ?? undefined,
      usedFallback: result.usedFallback,
    };
  }

  lastContentCalendarAiError = result.error ?? "All AI providers failed.";
  return { text: null, error: lastContentCalendarAiError };
}

function parseJsonBlock<T>(text: string): T | null {
  try {
    const cleaned = text.replace(/```json|```/g, "").trim();
    return JSON.parse(cleaned) as T;
  } catch {
    const objectJson = text.match(/\{[\s\S]*\}/)?.[0];
    if (objectJson) {
      try {
        return JSON.parse(objectJson) as T;
      } catch {
        // fall through
      }
    }
    const arrayJson = text.match(/\[[\s\S]*\]/)?.[0];
    if (arrayJson) {
      try {
        return JSON.parse(arrayJson) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await fn(items[index], index);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

type ParsedBulkRow = {
  dayIndex?: number;
  postType?: ContentCalendarPostType;
  targetGroup?: string;
  caption?: string;
  visualPrompt?: string | null;
  hashtags?: string[];
};

function rowToBulkDraft(args: {
  row: ParsedBulkRow;
  spec: BulkContentItem;
  index: number;
  scheduled: boolean;
  weekStart: string;
  monday: Date;
}): BulkGeneratedDraft {
  const postType = args.spec.postType;
  const dayIndex = args.scheduled
    ? Math.min(4, Math.max(0, args.row.dayIndex ?? args.index % 5))
    : 0;
  const postDate = args.scheduled ? formatCalendarDate(addWeekdays(args.monday, dayIndex)) : null;
  const targetGroup = normalizeTargetGroup(args.spec.targetGroup);
  const normalizedVisual = normalizeGeneratedVisualPrompt({
    caption: args.row.caption ?? "",
    visualPrompt: postType === "Text" ? null : (args.row.visualPrompt ?? ""),
    postType,
    targetGroup,
  });
  const content = applyPostRules(
    {
      caption: args.row.caption ?? "",
      visualPrompt: normalizedVisual,
      hashtags: args.row.hashtags ?? [],
    },
    postType,
  );

  return {
    tempId: `draft_${Date.now()}_${args.index}`,
    dayIndex,
    postType,
    targetGroup,
    platforms: CONTENT_CALENDAR_PLATFORMS_BY_TYPE[postType],
    ...content,
    postDate,
  };
}

async function generateBulkSlotWithAi(args: {
  item: BulkContentItem;
  slotIndex: number;
  customPrompt: string;
  contextBlock: string;
  scheduled: boolean;
  weekStart: string;
  dayIndex: number;
  monday: Date;
  feedback?: string;
  skipLazyCheck?: boolean;
}): Promise<BulkGeneratedDraft | null> {
  const targetGroup = normalizeTargetGroup(args.item.targetGroup);
  const postType = args.item.postType;
  const operatorDirective = buildOperatorCreativeDirective(args.customPrompt);
  const slotDirective = extractSlotDirectiveFromOperatorPrompt(args.customPrompt, targetGroup, postType);
  const slotBrief = buildBulkSlotBrief({
    index: args.slotIndex,
    item: { postType, targetGroup },
    customPrompt: args.customPrompt,
    dayLabel: args.scheduled ? CONTENT_CALENDAR_DAYS_LONG[args.dayIndex] : undefined,
  });
  const contextSnippet = trimContextBlockForPrompt(args.contextBlock);

  const system = `You are Match Fit's senior social content strategist.
${CONTENT_CALENDAR_BRAND_FACTS}
${CONTENT_CALENDAR_AI_RULES}
${CONTENT_CALENDAR_CREATIVE_QUALITY_RULES}

${contextSnippet}

You MUST return valid JSON only — no markdown fences, no commentary.
Format: {"caption":"...","visualPrompt":"... or null for Text","hashtags":["tag1","tag2"]}`;

  const user = `${operatorDirective}

${slotDirective ? `Slot-specific operator requirements:\n${slotDirective}\n` : ""}
${args.feedback ? `Revision note:\n${args.feedback}\n` : ""}
Generate exactly ONE publish-ready ${postType} post for ${targetGroup}.
${slotBrief}

Write a complete, original caption that implements the operator directive above.
Hashtags: JSON array without # prefix.`;

  const aiResult = await callAi(system, user, 2800, 0.7);
  const parsed = aiResult.text ? parseGeneratedPostPayload(aiResult.text) : null;
  if (!parsed?.caption?.trim()) return null;

  const draft = rowToBulkDraft({
    row: { ...parsed, postType, targetGroup },
    spec: args.item,
    index: args.slotIndex,
    scheduled: args.scheduled,
    weekStart: args.weekStart,
    monday: args.monday,
  });

  if (!args.skipLazyCheck && isLazyCalendarDraft(draft)) return null;
  return draft;
}

export async function researchHashtagsForDate(args: {
  postDate: string;
  postType: ContentCalendarPostType;
  targetGroup: string;
}): Promise<string[]> {
  const learning = await buildContentGenerationContext();
  const targetGroup = normalizeTargetGroup(args.targetGroup);
  const system = `You are a social media hashtag researcher for Match Fit.
${CONTENT_CALENDAR_BRAND_FACTS}
${CONTENT_CALENDAR_AI_RULES}
${learning}
Return ONLY JSON: {"hashtags":["tag1","tag2",...]} with exactly ${CONTENT_CALENDAR_MAX_HASHTAGS} tags (or fewer). Mix broad fitness and niche tags trending around ${args.postDate}. No # prefix. No Atlanta/local geo tags.`;
  const user = `Research best hashtags for ${args.postType} post targeting ${targetGroup} to publish on ${args.postDate}.`;
  const aiResult = await callAi(system, user, 600);
  const parsed = aiResult.text ? parseJsonBlock<{ hashtags?: string[] }>(aiResult.text) : null;
  const tags = normalizeHashtags(parsed?.hashtags ?? []);
  if (tags.length) {
    await recordContentLearning({
      signalType: "HASHTAG_RESEARCH",
      editedText: tags.map((t) => `#${t}`).join(" "),
      meta: { postDate: args.postDate, postType: args.postType, targetGroup },
    });
  }
  return tags.length ? tags : normalizeHashtags(["MatchFit", "FitnessApp", "BetaLaunch", "FitHub", "Workout"]);
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
  const learning = await buildContentGenerationContext();
  const rot = getContentCalendarRotation(args.dayIndex, args.offset);
  const targetGroup = rot[args.postType];
  const platforms = CONTENT_CALENDAR_PLATFORMS_BY_TYPE[args.postType];
  const system = `You are Match Fit's content calendar AI.
${CONTENT_CALENDAR_BRAND_FACTS}
${CONTENT_CALENDAR_AI_RULES}
${CONTENT_CALENDAR_CREATIVE_QUALITY_RULES}
${learning}
Respond ONLY with JSON: {"caption":"","visualPrompt":null,"hashtags":["tag1"]}
visualPrompt null only for Text posts.`;
  const user = `Regenerate ${CONTENT_CALENDAR_DAYS_LONG[args.dayIndex]} ${args.postType} for ${targetGroup} (week ${args.weekStart}).
Platforms: ${platforms}.
${args.existingCaption ? `Previous caption:\n${args.existingCaption}` : ""}
${args.existingVisualPrompt ? `Previous visual prompt:\n${args.existingVisualPrompt}` : ""}
${args.feedback ? `Operator feedback — apply these changes:\n${args.feedback}` : "Improve hook, clarity, and hashtags while keeping the same intent."}`;
  const aiResult = await callAi(system, user, 2500);
  const parsed = aiResult.text
    ? parseJsonBlock<{ caption?: string; visualPrompt?: string | null; hashtags?: string[] }>(aiResult.text)
    : null;
  if (!parsed) return null;
  const content = applyPostRules(
    {
      caption: parsed.caption ?? "",
      visualPrompt: args.postType === "Text" ? null : (parsed.visualPrompt ?? ""),
      hashtags: parsed.hashtags ?? [],
    },
    args.postType,
  );
  return {
    dayIndex: args.dayIndex,
    postType: args.postType,
    targetGroup,
    platforms,
    ...content,
  };
}

export async function generateSinglePost(args: {
  postType?: ContentCalendarGeneratorPostType;
  platform?: string;
  contentType: string;
  tone: string;
  customNote?: string;
}): Promise<{ hook: string; body: string; cta: string; hashtags: string[]; dmScript?: string } | null> {
  const learning = await buildContentGenerationContext();
  const operatorDirective = buildOperatorCreativeDirective(args.customNote ?? "");
  const system = `You are a social media strategist for Match Fit.
${CONTENT_CALENDAR_BRAND_FACTS}
${CONTENT_CALENDAR_AI_RULES}
${CONTENT_CALENDAR_CREATIVE_QUALITY_RULES}
${learning}
Generate authentic, specific content — scroll-stopping hook, core message with concrete Match Fit detail, CTA, platform hashtags.
Respond ONLY with JSON: {"hook":"","body":"","cta":"","hashtags":["tag1"],"dmScript":""}`;
  const platformLabel =
    args.postType
      ? CONTENT_CALENDAR_PLATFORMS_BY_TYPE[args.postType]
      : (args.platform ?? "Instagram");
  const user = `${operatorDirective}

Generate a ${args.tone} ${args.contentType} ${args.postType ? `${args.postType} ` : ""}post for ${platformLabel}.
${args.postType === "Text" ? "Text-only post: no visual or video prompt. Write for Threads/Facebook — concise, conversational caption structure." : "Include enough detail that a designer could storyboard the creative from your copy."}
Weave the operator directive into the hook and body — do not produce generic beta filler.
Target audiences to rotate between: Join the Team (Fitness Pro recruitment), List With Us (independent listing), Clients (athletes seeking training).
Goal: match-fit.net signups with audience-appropriate CTAs.`;
  const aiResult = await callAi(system, user);
  const parsed = aiResult.text
    ? parseJsonBlock<{ hook?: string; body?: string; cta?: string; hashtags?: string[]; dmScript?: string }>(aiResult.text)
    : null;
  if (!parsed) return null;
  const enforced = enforceGeneratedPostContent({
    caption: [parsed.hook, parsed.body, parsed.cta].filter(Boolean).join("\n\n"),
    hashtags: parsed.hashtags ?? [],
  });
  return {
    hook: normalizeFitnessProLanguage(parsed.hook ?? ""),
    body: normalizeFitnessProLanguage(parsed.body ?? ""),
    cta: normalizeFitnessProLanguage(parsed.cta ?? ""),
    hashtags: enforced.hashtags,
    dmScript: parsed.dmScript ? normalizeFitnessProLanguage(parsed.dmScript) : undefined,
  };
}

export async function generateWeekContent(args: {
  weekStart: string;
  offset: number;
}): Promise<GeneratedWeekPost[]> {
  const learning = await buildContentGenerationContext();
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
${CONTENT_CALENDAR_AI_RULES}
${CONTENT_CALENDAR_CREATIVE_QUALITY_RULES}
${learning}

Rotation for this week (M-F, keep exactly):
${rotationPlan}

Platform mapping: Carousel/Static→Instagram+Facebook captions+visual prompts; Video→Reels/TikTok with cinematic or UGC visual prompts; Text→Threads+Facebook (caption only, visualPrompt null).

Each post must include a specific hook, audience-relevant detail, and CTA — never placeholder copy that only lists post type and audience.

Respond ONLY with JSON array of 20 objects (5 days × 4 types):
[{"dayIndex":0,"postType":"Text","targetGroup":"Join the Team","caption":"...","visualPrompt":null,"hashtags":["MatchFit"]}]
dayIndex 0=Mon..4=Fri. postType one of Carousel|Static|Video|Text. targetGroup must be Join the Team, List With Us, or Clients only.`;

  const user = `Generate a full M-F content week starting ${args.weekStart}.
Use live scan context above for concrete promos, features, and proof points in every caption.
Visual prompts must describe scenes and subjects — not just hex colors.
Include day-of-week variety and founding beta urgency aligned with live promos. Hashtags without # in array.`;

  const aiResult = await callAi(system, user, 8000);
  const parsed = aiResult.text ? parseJsonBlock<GeneratedWeekPost[]>(aiResult.text) : null;
  if (!parsed || !Array.isArray(parsed)) return fallbackWeek(args.offset);

  return parsed.map((row) => {
    const postType = row.postType as ContentCalendarPostType;
    const rot = getContentCalendarRotation(row.dayIndex, args.offset);
    const content = applyPostRules(
      {
        caption: row.caption ?? "",
        visualPrompt: postType === "Text" ? null : (row.visualPrompt ?? ""),
        hashtags: row.hashtags ?? [],
      },
      postType,
    );
    return {
      dayIndex: row.dayIndex,
      postType,
      targetGroup: normalizeTargetGroup(row.targetGroup ?? rot[postType]),
      platforms: CONTENT_CALENDAR_PLATFORMS_BY_TYPE[postType],
      ...content,
    };
  });
}

function fallbackWeek(offset: number): GeneratedWeekPost[] {
  const posts: GeneratedWeekPost[] = [];
  for (let di = 0; di < 5; di++) {
    const rot = getContentCalendarRotation(di, offset);
    for (const postType of ["Text", "Video", "Carousel", "Static"] as ContentCalendarPostType[]) {
      const targetGroup = rot[postType];
      const content = applyPostRules(
        {
          caption: `Regenerate ${CONTENT_CALENDAR_DAYS_LONG[di]} ${postType} for ${targetGroup} — weekly AI batch failed. Use bulk generator with a specific operator prompt.`,
          visualPrompt:
            postType === "Text"
              ? null
              : `Regenerate ${postType}: describe a specific scene with people, action, setting, and headline text for ${targetGroup}.`,
          hashtags: ["MatchFit", "FitnessApp", "BetaLaunch"],
        },
        postType,
      );
      posts.push({
        dayIndex: di,
        postType,
        targetGroup,
        platforms: CONTENT_CALENDAR_PLATFORMS_BY_TYPE[postType],
        ...content,
      });
    }
  }
  return posts;
}

export type BulkContentItem = {
  postType: ContentCalendarPostType;
  targetGroup: string;
};

export async function assignBulkAudiencesWithAi(
  items: BulkContentItem[],
): Promise<Record<number, string>> {
  const learning = await buildContentGenerationContext({ forceRefresh: true });
  const socialScan = await scanAndRecordSocialProfiles();
  const groups = [...CONTENT_CALENDAR_GROUPS];

  const system = `You assign target audiences for Match Fit bulk social content.
${CONTENT_CALENDAR_BRAND_FACTS}
${CONTENT_CALENDAR_AI_RULES}
${learning}

Target groups (only these): ${groups.join(", ")}.
Post types: Carousel, Static, Video, Text.

Based on social performance scan and content strategy, assign the best target group for each requested post slot.
Respond ONLY with JSON array of objects in the same order as the input:
[{"targetGroup":"Join the Team"}]
targetGroup must be one of: ${groups.join(", ")}.`;

  const slotList = items
    .map((item, i) => `${i + 1}. ${item.postType} → suggest audience`)
    .join("\n");

  const user = `Social profile scan (use only this data for performance claims):
${socialScan.summary}

Assign target audiences for these ${items.length} posts:
${slotList}`;

  const aiResult = await callAi(system, user, Math.min(4000, 200 + items.length * 80));
  const parsed = aiResult.text ? parseJsonBlock<{ targetGroup: string }[]>(aiResult.text) : null;

  const result: Record<number, string> = {};
  items.forEach((item, i) => {
    const suggested = normalizeTargetGroup(parsed?.[i]?.targetGroup ?? item.targetGroup);
    result[i] = groups.includes(suggested) ? suggested : normalizeTargetGroup(item.targetGroup);
  });
  return result;
}

export type BulkGenerationMeta = {
  provider: string | null;
  model: string | null;
  failedCount: number;
  lastError: string | null;
  warning: string | null;
  usedGeminiFallback: boolean;
  geminiFallbackConfigured: boolean;
};

export async function generateBulkContent(args: {
  items: BulkContentItem[];
  scheduled: boolean;
  customPrompt?: string;
  weekStart: string;
  offset?: number;
}): Promise<{ drafts: BulkGeneratedDraft[]; meta: BulkGenerationMeta }> {
  resetLastContentCalendarAiError();
  contentCalendarGeminiFallbackUsed = false;
  const vaultStatus = getAiVaultStatus();
  const customPrompt =
    args.customPrompt?.trim() ||
    "Scan social media performance, website promos, and user activity to inform each post with specific Match Fit details.";
  const contextBlock = trimContextBlockForPrompt(await buildContentGenerationContext());
  const count = args.items.length;
  const monday = new Date(`${args.weekStart}T00:00:00`);
  const operatorDirective = buildOperatorCreativeDirective(customPrompt);

  const slotBriefs = args.items
    .map((item, index) =>
      buildBulkSlotBrief({
        index,
        item: {
          postType: item.postType,
          targetGroup: normalizeTargetGroup(item.targetGroup),
        },
        customPrompt,
        dayLabel: args.scheduled ? CONTENT_CALENDAR_DAYS_LONG[index % 5] : undefined,
      }),
    )
    .join("\n\n");

  const system = `You are Match Fit's bulk content generator AI.
${CONTENT_CALENDAR_BRAND_FACTS}
${CONTENT_CALENDAR_AI_RULES}
${CONTENT_CALENDAR_CREATIVE_QUALITY_RULES}

${contextBlock}

Generate ${count} distinct, publish-ready social posts — one per slot below.
Scheduling mode: ${args.scheduled ? "scheduled — assign logical day_index 0-4 (Mon-Fri) spread across the week" : "unscheduled — use day_index 0 for all"}.
Platform mapping: Carousel/Static→Instagram+Facebook; Video→Reels/TikTok; Text→Threads+Facebook (visualPrompt null for Text).

Return valid JSON only. Use this shape:
{"posts":[{"dayIndex":0,"postType":"Carousel","targetGroup":"Join the Team","caption":"...","visualPrompt":"...","hashtags":["MatchFit"]}]}
Include exactly ${count} posts in posts array, in slot order. Each caption must implement the operator directive with specific Match Fit details.`;

  const user = `${operatorDirective}

Week anchor: ${args.weekStart}.

Slot briefs:
${slotBriefs}

Create ${count} unique posts. Weave operator themes into every caption and visual prompt.`;

  const batchResult = await callAi(system, user, Math.min(12000, 1200 + count * 650), 0.7);
  if (batchResult.usedFallback) {
    contentCalendarGeminiFallbackUsed = true;
  }
  const parsed = batchResult.text
    ? parseGeneratedPostArrayPayload(batchResult.text) ?? parseJsonBlock<ParsedBulkRow[]>(batchResult.text)
    : null;

  let drafts: BulkGeneratedDraft[] = [];

  if (parsed && Array.isArray(parsed) && parsed.length > 0) {
    drafts = parsed.slice(0, count).map((row, i) =>
      rowToBulkDraft({
        row,
        spec: args.items[i],
        index: i,
        scheduled: args.scheduled,
        weekStart: args.weekStart,
        monday,
      }),
    );
  }

  const draftsOut = await mapWithConcurrency(args.items, 1, async (spec, i) => {
    const existing = drafts[i];
    const dayIndex = args.scheduled ? i % 5 : 0;

    if (existing && !isLazyCalendarDraft(existing)) {
      return { ...existing, tempId: `draft_${Date.now()}_${i}` };
    }

    const attempts = [
      {
        feedback: existing
          ? "Improve this draft — make the hook sharper and include more specific operator-requested details."
          : undefined,
        skipLazyCheck: false,
      },
      {
        feedback:
          "Previous attempt was too weak. Follow the operator directive literally — include the required promos, features, and audience angles for this slot.",
        skipLazyCheck: false,
      },
      {
        feedback: "Write the strongest possible version. Use concrete Match Fit promos, features, and CTAs from the operator directive.",
        skipLazyCheck: true,
      },
    ] as const;

    for (const attempt of attempts) {
      const draft = await generateBulkSlotWithAi({
        item: spec,
        slotIndex: i,
        customPrompt,
        contextBlock,
        scheduled: args.scheduled,
        weekStart: args.weekStart,
        dayIndex,
        monday,
        feedback: attempt.feedback,
        skipLazyCheck: attempt.skipLazyCheck,
      });
      if (draft) return draft;
    }

    if (existing?.caption?.trim()) {
      return { ...existing, tempId: `draft_${Date.now()}_${i}` };
    }

    const lastError = getLastContentCalendarAiError();
    const detail = lastError
      ? lastError
      : "The AI provider did not return usable copy — click Generate again or check server AI keys/logs.";

    return rowToBulkDraft({
      row: {
        caption: `Generation failed for ${spec.postType} (${normalizeTargetGroup(spec.targetGroup)}). ${detail}`,
        visualPrompt:
          spec.postType === "Text"
            ? null
            : normalizeGeneratedVisualPrompt({
                caption: `${spec.postType} for ${normalizeTargetGroup(spec.targetGroup)}`,
                visualPrompt: null,
                postType: spec.postType,
                targetGroup: normalizeTargetGroup(spec.targetGroup),
              }),
        hashtags: ["MatchFit"],
      },
      spec,
      index: i,
      scheduled: args.scheduled,
      weekStart: args.weekStart,
      monday,
    });
  });

  const failedCount = draftsOut.filter((draft) => /^Generation failed for /i.test(draft.caption)).length;
  const lastError = getLastContentCalendarAiError();
  const geminiFallbackConfigured = vaultStatus.geminiPrimary || vaultStatus.geminiBackup;
  const usedGeminiFallback = contentCalendarGeminiFallbackUsed;
  const fallbackNote = usedGeminiFallback
    ? ` Used Gemini fallback (${resolveGeminiModel()}) after Claude issues.`
    : "";
  const warning =
    failedCount === draftsOut.length && lastError
      ? `All ${failedCount} posts failed. ${lastError}${fallbackNote}`
      : failedCount > 0
        ? `${failedCount} of ${draftsOut.length} posts could not be generated. ${lastError ?? "Retry generation for failed slots."}${fallbackNote}`
        : usedGeminiFallback
          ? `Generation completed via Gemini fallback (${resolveGeminiModel()}) because Claude timed out or failed.`
          : null;

  return {
    drafts: draftsOut,
    meta: {
      provider: usedGeminiFallback ? "gemini" : vaultStatus.anthropic ? "anthropic" : null,
      model: usedGeminiFallback ? resolveGeminiModel() : null,
      failedCount,
      lastError,
      warning,
      usedGeminiFallback,
      geminiFallbackConfigured,
    },
  };
}

export async function analyzeSocialPerformance(forceRefresh = true): Promise<string> {
  const learning = await buildContentGenerationContext({ forceRefresh });
  const socialScan = forceRefresh
    ? await scanAndRecordSocialProfiles()
    : await (await import("@/lib/content-calendar/social-profile-scan")).scanMatchFitSocialProfiles();

  const system = `You analyze Match Fit social media performance for an operator dashboard.
${CONTENT_CALENDAR_BRAND_FACTS}
${CONTENT_CALENDAR_AI_RULES}
Be concise. Base recommendations ONLY on the fetched social profile data below — if a platform blocked the fetch, say so explicitly and do not invent metrics.
Bullet what's working, what's not, and 3 specific improvements for next week's calendar.`;
  const user = `${learning}

Fetched social profile data (authoritative — do not contradict or invent beyond this):
${socialScan.summary}

Summarize performance for @theofficialmatchfit on Instagram, TikTok, Facebook, and Threads. Note content types (video, carousel, static, text) and Fitness Pro recruitment vs client acquisition focus.`;

  const aiResult = await callAi(system, user, 1200);
  const summary =
    aiResult.text ?? aiResult.error ?? "Connect ANTHROPIC_API_KEY or OPENAI_API_KEY to run social performance analysis.";

  await recordContentLearning({
    signalType: "SOCIAL_SCAN",
    editedText: summary.slice(0, 4000),
    meta: { scannedAt: new Date().toISOString(), source: "admin_analysis" },
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
      prompt: `Match Fit fitness brand social graphic. Dark background #07080C, orange accent #FF7E00. ${normalizeFitnessProLanguage(prompt)}`.slice(
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
  const vault = getAiVaultStatus();
  const niBrain = Boolean(
    process.env.NI_BRAIN_SUPABASE_URL?.trim() && process.env.NI_BRAIN_SUPABASE_SERVICE_ROLE_KEY?.trim(),
  );
  const media = Boolean(process.env.OPENAI_API_KEY?.trim());
  const parts: string[] = [vault.message];
  if (!niBrain) parts.push("Add NI Brain Supabase keys (Vercel env or platform_secrets) for learning persistence.");
  if (!media) parts.push("Add OPENAI_API_KEY for static image generation.");
  return {
    configured: vault.configured,
    niBrain,
    media,
    message: parts.filter(Boolean).join(" "),
  };
}
