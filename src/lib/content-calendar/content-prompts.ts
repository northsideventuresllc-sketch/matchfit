import {
  CONTENT_CALENDAR_GROUP_DESCRIPTIONS,
  CONTENT_CALENDAR_PLATFORMS_BY_TYPE,
  MATCH_FIT_BRAND_DARK,
  MATCH_FIT_BRAND_ORANGE,
  MATCH_FIT_LOGO_PATH,
  type ContentCalendarGroup,
  type ContentCalendarPostType,
} from "@/lib/content-calendar/constants";
import {
  hasBrokenSocialSignupUrl,
  hasForbiddenSocialAudienceLabel,
  isSlideInventoryCarouselCaption,
} from "@/lib/content-calendar/content-rules";

export type BulkContentSlotSpec = {
  postType: ContentCalendarPostType;
  targetGroup: ContentCalendarGroup;
};

export type AudienceCreativeBrief = {
  who: string;
  goals: string[];
  hooks: string[];
  cta: string;
  avoid: string[];
};

export const AUDIENCE_CREATIVE_BRIEFS: Record<ContentCalendarGroup, AudienceCreativeBrief> = {
  "Join the Team": {
    who: "Fitness Pros exploring Match Fit as their next platform home",
    goals: [
      "Show why verified Match Fit Fitness Pros stand out in discovery",
      "Highlight founding promos (30×60-day Premium; first 10 fee waiver), onboarding support, and in-app client tools",
      "Make signup feel urgent but credible — not hype without substance",
    ],
    hooks: [
      "Stop renting attention on feeds that do not convert",
      "Build a verified Fitness Pro brand where clients actually book",
      "Founding cohort: Premium access window + waived onboarding fees for early Fitness Pros",
    ],
    cta: "Drive to match-fit.net/trainer/sign-up with a clear next step",
    avoid: [
      "Generic 'we are hiring' language without a concrete Fitness Pro benefit",
      "Saying Coaches — use Fitness Pros",
      "Wrong signup paths — always use match-fit.net/trainer/sign-up",
      "Lazy copy-paste of the same promo sentence — vary wording, keep meaning",
    ],
  },
  "List With Us": {
    who: "independent Fitness Pros, studios, and facilities who want discovery without full marketplace onboarding",
    goals: [
      "Explain listing/discovery value for brands that keep their own booking flow",
      "Show how nudges, featured placement, and external links work on Match Fit",
      "Position Match Fit as amplification, not another complicated CRM",
    ],
    hooks: [
      "Get discovered by local clients without rebuilding your entire business online",
      "List your brand where athletes are already searching for training",
      "Independent Pro path: fast listing, your site, your pricing",
    ],
    cta: "Drive to match-fit.net/trainer/sign-up or explore listing benefits on match-fit.net",
    avoid: [
      "Talking about full Match Fit verification if the angle is independent listing",
      "Saying Coaches — use Fitness Pros",
      "Wrong signup paths — always use match-fit.net/trainer/sign-up",
    ],
  },
  Clients: {
    who: "athletes and everyday people looking for the right Fitness Pro or training plan",
    goals: [
      "Speak to real client pain: inconsistency, bad matches, overwhelm choosing a Fitness Pro",
      "Show swipe discovery, Fit Hub community, VIP trial, and matching quality",
      "Make trying Match Fit feel low-friction and outcome-focused",
    ],
    hooks: [
      "Stop scrolling random profiles — get matched to a Fitness Pro who fits your goals",
      "Beta VIP trial: explore premium discovery before you commit",
      "Training that fits your schedule, in-person or virtual",
    ],
    cta: "Drive to match-fit.net/client/sign-up with a specific outcome in the post",
    avoid: [
      "Fitness Pro recruitment language when speaking to clients",
      "Sending clients to /trainer/sign-up — clients use match-fit.net/client/sign-up",
    ],
  },
};

export const POST_TYPE_CREATIVE_BRIEFS: Record<
  ContentCalendarPostType,
  { captionShape: string; visualShape: string }
> = {
  Carousel: {
    captionShape:
      "Same as Static: bold hook, one clear insight or stat, emotional payoff, CTA. Do NOT describe or inventory slides in the caption — slide structure belongs only in the visual prompt.",
    visualShape:
      "Describe 3–5 carousel frames: subject, action, on-slide headline text, layout, and mood. Brand orange/dark palette as accents only.",
  },
  Static: {
    captionShape: "Bold hook, one clear insight or stat, emotional payoff, CTA.",
    visualShape:
      "Single-image composition: focal subject, environment, lighting, headline text placement, and emotional tone.",
  },
  Video: {
    captionShape: "Pattern-interrupt hook, 2–3 beat story arc for Reels/TikTok, spoken-style CTA.",
    visualShape:
      "Shot list: opening hook frame, b-roll ideas, on-screen captions, pacing (UGC vs cinematic), and setting.",
  },
  Text: {
    captionShape:
      "Threads/Facebook-native conversational post: opinion or story opening, concrete detail, question or CTA. No image.",
    visualShape: "null — Text posts have no visualPrompt.",
  },
};

const LAZY_CAPTION_RE =
  /^(?:◈|▣|▶|≡)?\s*(?:Carousel|Static|Video|Text)\s*(?:#\d+\s*)?for\s+(?:Join the Team|List With Us|Clients)\s*[—–-]\s*Match Fit/i;

const LAZY_VISUAL_RE =
  /^Dark\s+#07080C(?:,\s*|\s+)orange\s+#FF7E00\.?\s*(?:◈|▣|▶|≡)?\s*(?:Carousel|Static|Video|Text)\s*for/i;

export function extractSlotDirectiveFromOperatorPrompt(
  customPrompt: string,
  targetGroup: ContentCalendarGroup,
  postType: ContentCalendarPostType,
): string {
  const prompt = customPrompt.trim();
  if (!prompt) return "";

  const lines: string[] = [];
  const audiencePatterns: Record<ContentCalendarGroup, RegExp> = {
    "Join the Team":
      /(?:^|\n)\s*-?\s*Join The Team\s*:([\s\S]*?)(?=\n\s*-?\s*(?:List With Us|Clients|RULES)\b|$)/i,
    "List With Us":
      /(?:^|\n)\s*-?\s*List With Us\s*:([\s\S]*?)(?=\n\s*-?\s*(?:Clients|RULES|Join The Team)\b|$)/i,
    Clients:
      /(?:^|\n)\s*-?\s*Clients\s*:([\s\S]*?)(?=\n\s*-?\s*(?:RULES|Join The Team|List With Us)\b|$)/i,
  };

  const section = prompt.match(audiencePatterns[targetGroup]);
  if (section?.[1]?.trim()) {
    lines.push(`Audience-specific operator notes:\n${section[1].trim()}`);
  }

  const rules = prompt.match(/(?:^|\n)\s*RULES\s*:([\s\S]*)/i);
  if (rules?.[1]?.trim()) {
    lines.push(`Global rules:\n${rules[1].trim()}`);
  }

  const intro = prompt.match(/^([\s\S]*?)(?=\n\s*-?\s*Join The Team\s*:)/i);
  if (intro?.[1]?.trim()) {
    lines.unshift(`Batch guidance:\n${intro[1].trim()}`);
  }

  if (postType === "Carousel") {
    lines.push(
      "Caption must be static-style (hook → insight → payoff → CTA). Do not describe or inventory slides in the caption — slide frames belong only in visualPrompt.",
    );
  }

  if (
    targetGroup === "Join the Team" &&
    /background check|founding|onboarding fee|premium|promo/i.test(prompt)
  ) {
    lines.push(
      "Mandatory founding promo meaning (vary wording — do not regurgitate): first 30 Fitness Pros get 60 days Premium access free (all tools / maximize opportunity); first 10 Fitness Pros get onboarding fees waived completely.",
    );
  }

  if (targetGroup === "Clients") {
    if (/vip|60 day|150 client/i.test(prompt)) {
      lines.push("Work in the 60-day VIP pass for the first 150 clients where it fits this post.");
    }
    if (/fit hub|fithub/i.test(prompt)) {
      lines.push("Highlight Fit Hub as a game-changer for fitness content and finding Fitness Pros.");
    }
    if (/swipe|tinder/i.test(prompt)) {
      lines.push("Stress swipe-based discovery — the Tinder of the fitness industry.");
    }
    if (/free to join/i.test(prompt)) {
      lines.push("Stress FREE TO JOIN.");
    }
  }

  if (targetGroup === "List With Us" && /independent pro/i.test(prompt)) {
    lines.push("Highlight Independent Pro listing perks, algorithmic matching for listings, and business discovery benefits.");
  }

  return lines.join("\n\n");
}

export function trimContextBlockForPrompt(contextBlock: string, maxChars = 2200): string {
  const trimmed = contextBlock.trim();
  if (trimmed.length <= maxChars) return trimmed;
  return `${trimmed.slice(0, maxChars)}\n\n[Context truncated for generation — prioritize the operator directive.]`;
}

export function buildOperatorCreativeDirective(customPrompt: string): string {
  const trimmed = customPrompt.trim();
  if (!trimmed) {
    return [
      "Operator directive: Use live website promo scan, social performance scan, and NI Brain learnings.",
      "Each post must reference at least one concrete Match Fit feature, promo, or user outcome — never generic filler.",
    ].join("\n");
  }
  return [
    "PRIMARY OPERATOR DIRECTIVE — this is the main creative brief.",
    "You MUST weave specific themes, angles, and phrases from this directive into EVERY caption and visual prompt.",
    "Do not ignore it. Do not merely mention the audience name or brand colors.",
    trimmed,
  ].join("\n\n");
}

export function buildBulkSlotBrief(args: {
  index: number;
  item: BulkContentSlotSpec;
  customPrompt: string;
  dayLabel?: string;
}): string {
  const audience = AUDIENCE_CREATIVE_BRIEFS[args.item.targetGroup];
  const postType = POST_TYPE_CREATIVE_BRIEFS[args.item.postType];
  const platforms = CONTENT_CALENDAR_PLATFORMS_BY_TYPE[args.item.postType];
  const slotDirective = extractSlotDirectiveFromOperatorPrompt(
    args.customPrompt,
    args.item.targetGroup,
    args.item.postType,
  );

  return [
    `Slot ${args.index + 1}: ${args.item.postType} → ${args.item.targetGroup}`,
    args.dayLabel ? `Schedule: ${args.dayLabel}` : null,
    `Audience: ${CONTENT_CALENDAR_GROUP_DESCRIPTIONS[args.item.targetGroup]}`,
    `Who we are talking to: ${audience.who}`,
    `Goals: ${audience.goals.join(" | ")}`,
    `Hook angles (pick one or blend): ${audience.hooks.join(" | ")}`,
    `CTA: ${audience.cta}`,
    `Caption structure: ${postType.captionShape}`,
    args.item.postType === "Text"
      ? "visualPrompt: null"
      : `Visual prompt structure: ${postType.visualShape}`,
    `Platforms: ${platforms}`,
    slotDirective || "Follow the PRIMARY OPERATOR DIRECTIVE for this audience and post type.",
  ]
    .filter(Boolean)
    .join("\n");
}

export type MediaPostType = Exclude<ContentCalendarPostType, "Text">;

export type MediaDimensionSpec = {
  aspectRatio: string;
  pixels: string;
  orientation: string;
  usage: string;
};

/**
 * Per-post-type dimension matrix for media generation. Chosen against standard 2026 platform
 * specs: full-screen vertical 9:16 for short-form video (Reels / TikTok / Facebook Reels /
 * Threads video), 4:5 portrait for feed stills (maximizes Instagram/Facebook/Threads feed real
 * estate and crops safely to 1:1), and a consistent 4:5 across every carousel frame.
 */
export const MEDIA_DIMENSION_MATRIX: Record<MediaPostType, MediaDimensionSpec> = {
  Video: {
    aspectRatio: "9:16",
    pixels: "1080x1920",
    orientation: "vertical",
    usage: "Reels / TikTok / Facebook Reels / Threads video — full-screen vertical (safe-zone captions clear of the bottom UI)",
  },
  Static: {
    aspectRatio: "4:5",
    pixels: "1080x1350",
    orientation: "portrait",
    usage: "Instagram / Facebook / Threads feed single image — 4:5 portrait crops safely to 1:1",
  },
  Carousel: {
    aspectRatio: "4:5",
    pixels: "1080x1350",
    orientation: "portrait",
    usage: "Instagram / Facebook / TikTok / Threads swipeable carousel — hold a consistent 4:5 across every frame",
  },
};

/**
 * Shared media-generation prompt builder used by all three media post types (Static, Carousel,
 * Video). Wraps the creative visual prompt with the mandatory production spec: correct output
 * dimensions for the target use, explicit brand color values, and an explicit Match Fit logo
 * reference. The actual logo image is attached client-side during Fire Cowork — this only
 * guarantees the prompt TEXT calls for the logo + palette.
 */
export function buildMediaGenerationPrompt(args: {
  postType: MediaPostType;
  visualPrompt: string | null | undefined;
  caption: string;
  targetGroup: ContentCalendarGroup;
}): string {
  const dims = MEDIA_DIMENSION_MATRIX[args.postType];
  const creative =
    normalizeGeneratedVisualPrompt({
      caption: args.caption,
      visualPrompt: args.visualPrompt,
      postType: args.postType,
      targetGroup: args.targetGroup,
    }) ?? args.caption;

  return [
    creative,
    "",
    "PRODUCTION SPEC (required):",
    `- Output dimensions: ${dims.pixels}px, ${dims.aspectRatio} ${dims.orientation}. Use case: ${dims.usage}.`,
    `- Brand colors: dark background ${MATCH_FIT_BRAND_DARK} with ${MATCH_FIT_BRAND_ORANGE} orange as the accent (headline text, highlights, CTA chip). Do not invent other brand colors.`,
    `- Incorporate the Match Fit logo (${MATCH_FIT_LOGO_PATH}) — place it cleanly (corner or lockup) without covering the focal subject or headline. The logo file is attached to this job for reference.`,
    args.postType === "Carousel"
      ? "- Keep the logo placement, palette, and 4:5 frame consistent across all carousel slides."
      : args.postType === "Video"
        ? "- Apply the spec to the opening hook frame / thumbnail and keep on-screen text inside the vertical safe zone."
        : "- Single composition — headline, subject, logo, and CTA must read at a glance.",
  ].join("\n");
}

export function isLazyCalendarCaption(caption: string): boolean {
  const trimmed = caption.trim();
  if (!trimmed) return true;
  if (/^Could not generate /i.test(trimmed)) return true;
  if (/^Regenerate /i.test(trimmed)) return true;
  if (LAZY_CAPTION_RE.test(trimmed)) return true;
  if (/Match Fit beta\.?\s*match-fit\.net\s*$/i.test(trimmed) && trimmed.length < 120) return true;
  return false;
}

export function normalizeGeneratedVisualPrompt(args: {
  caption: string;
  visualPrompt: string | null | undefined;
  postType: ContentCalendarPostType;
  targetGroup: ContentCalendarGroup;
}): string | null {
  if (args.postType === "Text") return null;
  const trimmed = (args.visualPrompt ?? "").trim();
  if (trimmed.length >= 40 && !LAZY_VISUAL_RE.test(trimmed)) return trimmed;
  const hook = args.caption.split(/[.!?\n]/)[0]?.trim() || args.caption.slice(0, 120);
  return `Match Fit ${args.postType} for ${args.targetGroup}: ${hook}. Show authentic fitness scene with people in action, bold headline text overlay, dark brand backdrop with orange accent lighting, scroll-stopping composition.`;
}

export function isLazyCalendarVisualPrompt(
  visualPrompt: string | null | undefined,
  postType: ContentCalendarPostType,
): boolean {
  if (postType === "Text") return false;
  const trimmed = (visualPrompt ?? "").trim();
  if (!trimmed) return false;
  if (LAZY_VISUAL_RE.test(trimmed)) return true;
  if (/^Regenerate /i.test(trimmed)) return true;
  return false;
}

export function isLazyCalendarDraft(args: {
  caption: string;
  visualPrompt: string | null;
  postType: ContentCalendarPostType;
}): boolean {
  if (isLazyCalendarCaption(args.caption)) return true;
  if (hasForbiddenSocialAudienceLabel(args.caption)) return true;
  if (hasBrokenSocialSignupUrl(args.caption)) return true;
  if (args.postType === "Carousel" && isSlideInventoryCarouselCaption(args.caption)) return true;
  return false;
}

export const CONTENT_CALENDAR_CREATIVE_QUALITY_RULES = `Creative quality (non-negotiable):
- Every caption needs a specific hook, concrete Match Fit detail (feature, promo, workflow, or outcome), and audience-appropriate CTA.
- Never output placeholder captions like "{PostType} for {Audience} — Match Fit beta. match-fit.net".
- Say Fitness Pros — never Coaches in social captions.
- Fitness Pro CTAs must use match-fit.net/trainer/sign-up (validated before accept).
- Carousel captions must match Static caption quality — never inventory slides in the caption.
- Founding promo: first 30 Fitness Pros → 60 days Premium free; first 10 Fitness Pros → onboarding fees waived. Vary wording; keep meaning.
- Visual prompts must describe subjects, scenes, actions, camera/framing, mood, and on-screen text — NOT just hex colors and audience labels.
- Brand palette (#07080C dark, #FF7E00 orange) is an accent reference only; it is not a substitute for creative direction.
- Pull at least one specific insight from the operator directive, website scan, or social scan when provided.
- Each slot in a batch must be meaningfully different in hook, angle, CTA, and promo phrasing.`;
