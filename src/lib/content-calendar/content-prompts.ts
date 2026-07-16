import {
  CONTENT_CALENDAR_GROUP_DESCRIPTIONS,
  CONTENT_CALENDAR_PLATFORMS_BY_TYPE,
  type ContentCalendarGroup,
  type ContentCalendarPostType,
} from "@/lib/content-calendar/constants";

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
    who: "trainers and coaches exploring Match Fit as their next platform home",
    goals: [
      "Show why verified Match Fit Pros stand out in discovery",
      "Highlight founding promos, onboarding support, and in-app client tools",
      "Make signup feel urgent but credible — not hype without substance",
    ],
    hooks: [
      "Stop renting attention on feeds that do not convert",
      "Build a verified Fitness Pro brand where clients actually book",
      "Founding cohort benefits and Premium Pro access at launch",
    ],
    cta: "Drive to match-fit.net/trainer/signup with a clear next step",
    avoid: [
      "Generic 'we are hiring' language without a concrete Fit Pro benefit",
      "Wrong signup paths like match-fit.net/Fitness Pro/signup — always use match-fit.net/trainer/signup",
    ],
  },
  "List With Us": {
    who: "independent trainers, studios, and facilities who want discovery without full marketplace onboarding",
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
    cta: "Drive to match-fit.net/trainer/signup or explore listing benefits on match-fit.net",
    avoid: [
      "Talking about full Match Fit verification if the angle is independent listing",
      "Wrong signup paths like match-fit.net/Fitness Pro/signup — always use match-fit.net/trainer/signup",
    ],
  },
  Clients: {
    who: "athletes and everyday people looking for the right Fitness Pro or training plan",
    goals: [
      "Speak to real client pain: inconsistency, bad matches, overwhelm choosing a coach",
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
      "Trainer recruitment language when speaking to clients",
      "Sending clients to /trainer/signup — clients use match-fit.net/client/sign-up",
    ],
  },
};

export const POST_TYPE_CREATIVE_BRIEFS: Record<
  ContentCalendarPostType,
  { captionShape: string; visualShape: string }
> = {
  Carousel: {
    captionShape:
      "Hook line, 2–3 swipe-worthy slide ideas summarized in the caption, strong CTA. Write as if each slide teaches one micro-point.",
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

  if (
    targetGroup === "Join the Team" &&
    (postType === "Static" || postType === "Text") &&
    /background check/i.test(prompt)
  ) {
    lines.push(
      "Mandatory for this slot: lead with the first 10 Match Fit Pros receiving fully covered background checks from Match Fit (zero upfront screening cost).",
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
  return isLazyCalendarCaption(args.caption);
}

export const CONTENT_CALENDAR_CREATIVE_QUALITY_RULES = `Creative quality (non-negotiable):
- Every caption needs a specific hook, concrete Match Fit detail (feature, promo, workflow, or outcome), and audience-appropriate CTA.
- Never output placeholder captions like "{PostType} for {Audience} — Match Fit beta. match-fit.net".
- Visual prompts must describe subjects, scenes, actions, camera/framing, mood, and on-screen text — NOT just hex colors and audience labels.
- Brand palette (#07080C dark, #FF7E00 orange) is an accent reference only; it is not a substitute for creative direction.
- Pull at least one specific insight from the operator directive, website scan, or social scan when provided.
- Each slot in a batch must be meaningfully different in hook, angle, and CTA.`;
