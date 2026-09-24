import {
  CONTENT_ARCHETYPE_LABELS,
  CONTENT_CALENDAR_GROUP_DESCRIPTIONS,
  CONTENT_CALENDAR_PLATFORMS_BY_TYPE,
  MATCH_FIT_AVATAR_IMAGE_PATH,
  MATCH_FIT_AVATAR_NAME,
  MATCH_FIT_AVATAR_PROMPT_DIRECTIVE,
  MATCH_FIT_BRAND_DARK,
  MATCH_FIT_BRAND_ORANGE,
  MATCH_FIT_LOGO_PATH,
  type ContentArchetype,
  type ContentCalendarGroup,
  type ContentCalendarPostType,
} from "@/lib/content-calendar/constants";
import {
  hasBrokenSocialSignupUrl,
  isSlideInventoryCarouselCaption,
} from "@/lib/content-calendar/content-rules";

export type BulkContentSlotSpec = {
  postType: ContentCalendarPostType;
  targetGroup: ContentCalendarGroup;
  archetype?: ContentArchetype;
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
      "Highlight founding promos (30×60-day Premium; 30×fee waiver), onboarding support, and in-app client tools",
      "Make signup feel urgent but credible — not hype without substance",
    ],
    hooks: [
      "Stop renting attention on feeds that do not convert 🔥",
      "Build a verified Fitness Pro brand where clients actually book ⚡",
      "Founding cohort: Premium access window + waived onboarding fees for early Fitness Pros 🚀",
    ],
    cta: "Drive to match-fit.net/trainer/sign-up with a clear next step",
    avoid: [
      "Generic 'we are hiring' language without a concrete Fitness Pro benefit",
      "Saying Coaches — use Fitness Pros",
      "Wrong signup paths — always use match-fit.net/trainer/sign-up",
      "Lazy copy-paste of the same promo sentence — vary wording, keep meaning",
      "Using markdown bold (**) — keep in natural plain English with emojis",
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
      "Get discovered by local clients without rebuilding your entire business online 📲",
      "List your brand where athletes are already searching for training 🎯",
      "Independent Pro path: fast listing, your site, your pricing 🏆",
    ],
    cta: "Drive to match-fit.net/trainer/sign-up or explore listing benefits on match-fit.net",
    avoid: [
      "Talking about full Match Fit verification if the angle is independent listing",
      "Saying Coaches — use Fitness Pros",
      "Wrong signup paths — always use match-fit.net/trainer/sign-up",
      "Using markdown bold (**) — keep in natural plain English with emojis",
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
      "Stop scrolling random profiles — get matched to a Fitness Pro who fits your goals 👀",
      "Beta VIP trial: explore premium discovery before you commit ⚡",
      "Training that fits your schedule, in-person or virtual 💪",
    ],
    cta: "Drive to match-fit.net/client/sign-up with a specific outcome in the post",
    avoid: [
      "Fitness Pro recruitment language when speaking to clients",
      "Sending clients to /trainer/sign-up — clients use match-fit.net/client/sign-up",
      "Using markdown bold (**) — keep in natural plain English with emojis",
    ],
  },
};

export const POST_TYPE_CREATIVE_BRIEFS: Record<
  ContentCalendarPostType,
  { captionShape: string; visualShape: string }
> = {
  Carousel: {
    captionShape:
      "Same as Static: eye-catching emoji hook, one clear insight or stat, emotional payoff, CTA. Use 2–4 vibrant emojis (🔥, ⚡, 💪, 🎯). Pure plain English (NEVER markdown asterisks **). Do NOT describe or inventory slides in the caption — slide structure belongs only in the visual prompt.",
    visualShape:
      "Follow Carousel Image Format:\nSlide Number: (slide # of #)\nMain Prompt: (detailed scene description with cross-slide consistency)\nOn Screen Text: (quoted text, font, features, coloring)\n\nProduction Specs:\n-Dimensions & Format: 1080x1350, 4:5 portrait swipeable carousel (Instagram/Facebook/Threads/TikTok)\n-Brand Colors: dark background #07080C with #FF7E00 orange accents\n-Logos & Other Branding: Match Fit logo placed consistently\n-References: match-fit.net\n-Rules:\n\t-All text and important content of the images stays in the top 3/4 of the image\n\t-ALL TEXT WITHIN THE IMAGE AND UI DETAILS MUST BE COMPLETELY RENDERED WITHOUT ANY \"AI SLOP\" AND POORLY RENDERED TEXT",
  },
  Static: {
    captionShape:
      "Eye-catching emoji hook, one clear insight or stat, emotional payoff, CTA. Use 2–4 vibrant emojis (🔥, ⚡, 💪, 🎯). Pure plain English (NEVER markdown asterisks **).",
    visualShape:
      "Follow Static Image Format:\nMain Prompt: (detailed scene description)\nOn Screen Text: (quoted text, font, features, coloring)\n\nProduction Specs:\n-Dimensions & Format: 1080x1350, 4:5 portrait (Instagram/Facebook/Threads)\n-Brand Colors: dark background #07080C with #FF7E00 orange accents\n-Logos & Other Branding: Match Fit logo placed cleanly\n-References: match-fit.net\n-Rules:\n\t-All text and important content of the image stays in the top 3/4 of the image\n\t-ALL TEXT WITHIN THE IMAGE AND UI DETAILS MUST BE COMPLETELY RENDERED WITHOUT ANY \"AI SLOP\" AND POORLY RENDERED TEXT",
  },
  Video: {
    captionShape:
      "Pattern-interrupt emoji hook, 2–3 beat story arc for Reels/TikTok, spoken-style CTA. Use 2–4 vibrant emojis (🔥, ⚡, 🚀, 👀). Pure plain English (NEVER markdown asterisks **).",
    visualShape:
      "Follow Video Format:\nMain Prompt: (detailed scene-by-scene description, timestamps, narrator script, transitions, style)\nOn Screen Text: (quoted text, timed appearance, font, features, coloring)\n\nProduction Specs:\n-Dimensions & Format: 1080x1920, 9:16 vertical video (Reels/TikTok/Shorts)\n-Brand Colors: dark background #07080C with #FF7E00 orange accents\n-Logos & Other Branding: Match Fit logo in watermark/end card\n-References: match-fit.net\n-Rules:\n\t-All text and important content of the video stays in the top 3/4 of the frame\n\t-ALL TEXT WITHIN THE IMAGE AND UI DETAILS MUST BE COMPLETELY RENDERED WITHOUT ANY \"AI SLOP\" AND POORLY RENDERED TEXT",
  },
  Text: {
    captionShape:
      "Threads/Facebook-native conversational post: eye-catching emoji hook, opinion or story opening, concrete detail, question or CTA. Use 2–4 vibrant emojis (🔥, ⚡, 🚀, 💪). Pure plain English (NEVER markdown asterisks **). No image.",
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
      "Mandatory founding promo meaning (vary wording — do not regurgitate): first 30 Fitness Pros get 60 days Premium access free (all tools / maximize opportunity) AND get onboarding fees waived completely.",
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

  if (/PRODUCTION SPEC|Production Specs/i.test(creative)) {
    return creative;
  }

  const isUgcOrAvatar = /UGC|avatar|Jordan|talking head/i.test(creative) || /UGC|avatar|Jordan|talking head/i.test(args.caption);

  return [
    creative,
    "",
    "Production Specs:",
    `-Dimensions & Format: ${dims.pixels}, ${dims.aspectRatio} ${dims.orientation} (${dims.usage})`,
    `-Brand Colors: dark background ${MATCH_FIT_BRAND_DARK} with ${MATCH_FIT_BRAND_ORANGE} orange as the accent (headline text, highlights, CTA chip). Do not invent other brand colors.`,
    `-Logos & Other Branding: incorporate Match Fit logo (${MATCH_FIT_LOGO_PATH}) cleanly without covering focal subject or headline. Reference logo attached.`,
    isUgcOrAvatar
      ? `-References: match-fit.net | avatar character reference attached (${MATCH_FIT_AVATAR_IMAGE_PATH}) | reference image attached`
      : "-References: match-fit.net | reference image attached",
    isUgcOrAvatar ? `-Character Identity: ${MATCH_FIT_AVATAR_NAME} (Match Fit Official Talking Head Avatar — charismatic 28yo athletic trainer in studio).` : null,
    "-Rules:",
    "\t-All text and important content of the image stays in the top 3/4 of the image",
    '\t-ALL TEXT WITHIN THE IMAGE AND UI DETAILS MUST BE COMPLETELY RENDERED WITHOUT ANY "AI SLOP" AND POORLY RENDERED TEXT',
    args.postType === "Carousel"
      ? "\t-Keep logo placement, palette, and 4:5 frame consistent across all carousel slides."
      : args.postType === "Video"
        ? "\t-Apply the spec to opening hook frame / thumbnail and keep on-screen text inside vertical safe zone."
        : "\t-Single composition — headline, subject, logo, and CTA must read at a glance.",
  ].filter(Boolean).join("\n");
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
  return `Static Image Format\nMain Prompt: Authentic fitness scene for ${args.targetGroup} with people in action, bold composition: ${hook}.\nOn Screen Text: Bold text with an orange glow reading \"${hook}\"\n\nProduction Specs:\n-Dimensions & Format: 1080x1350, 4:5 portrait\n-Brand Colors: dark background #07080C with #FF7E00 orange accents\n-Logos & Other Branding: Match Fit logo placed cleanly\n-References: match-fit.net\n-Rules:\n\t-All text and important content of the image stays in the top 3/4 of the image\n\t-ALL TEXT WITHIN THE IMAGE AND UI DETAILS MUST BE COMPLETELY RENDERED WITHOUT ANY "AI SLOP" AND POORLY RENDERED TEXT`;
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
  // "coach"/"trainer" are allowed (preferred, even) in social captions now — see
  // normalizeSocialContentLanguage. Only a broken signup URL is still a hard reject.
  if (hasBrokenSocialSignupUrl(args.caption)) return true;
  if (args.postType === "Carousel" && isSlideInventoryCarouselCaption(args.caption)) return true;
  return false;
}

export const CONTENT_CALENDAR_CREATIVE_QUALITY_RULES = `Creative quality (non-negotiable):
- EMOJIS (Required & Eye-Catching): Use 2–4 vibrant, eye-catching emojis (🔥, ⚡, 🚀, 💪, 🎯, 🏆, 👀, 📲, ✨, 📈) in EVERY caption and text post. Place them naturally in the opening hook, bullet points, and CTA so posts immediately pop in social feeds.
- NO MARKDOWN BOLDING (**): Never use asterisks (**) or (*) in captions or text posts. Social captions do not support markdown bold; writing ** is AI slop. Write pure, natural plain English with emojis for visual emphasis.
- The 3 Content Archetypes (Balanced Mix):
  1) GENERIC INFORMATIONAL: Direct benefit-driven posts explaining Match Fit features (Fit Hub, swipe discovery, founding coach promos, VIP client trial, independent listings). Clear, high-converting value.
  2) UGC AVATAR TALKING HEAD: UGC creator content starring Jordan Blake (Match Fit's official AI coach/talking head avatar). Relatable, front-camera smartphone framing, conversational advice, candid reactions, real-talk fitness problem solving. Every UGC prompt MUST reference the avatar image (${MATCH_FIT_AVATAR_IMAGE_PATH}).
  3) CINEMATIC TRAILER (Video Only): High-production teaser / trailer pushing Match Fit creatively. Dramatic athletic action, high-energy movie-trailer narrative arc, intense lighting, motivational beats, and bold on-screen titles.
- Every caption needs a specific hook, concrete Match Fit detail (feature, promo, workflow, or outcome), and audience-appropriate CTA.
- Never output placeholder captions like "{PostType} for {Audience} — Match Fit beta. match-fit.net".
- Lead with trending, widely-understood words — "coach", "trainer", "personal trainer". "Fitness Pro" is our internal brand term: use it sparingly, never lead with it while the brand is still being established.
- Match Fit is worldwide — never say "nationwide", "across the country", or name a place.
- Signup CTAs must use match-fit.net/trainer/sign-up (validated before accept).
- Carousel captions must match Static caption quality — never inventory slides in the caption.
- Founding promo: first 30 Fitness Pros → 60 days Premium free AND onboarding fees waived. Vary wording; keep meaning.
- Visual prompts must describe subjects, scenes, actions, camera/framing, mood, and on-screen text — NOT just hex colors and audience labels.
- Brand palette (#07080C dark, #FF7E00 orange) is an accent reference only; it is not a substitute for creative direction.
- Pull at least one specific insight from the operator directive, website scan, social scan, daily market research, or social performance analytics when provided.
- Each slot in a batch must be meaningfully different in hook, angle, CTA, and promo phrasing.

Visual prompt REQUIRED FORMATS (Non-negotiable — every generated visual prompt MUST follow one of these outlines exactly):

=============================================================================================
Static Image Format
Main Prompt: (describe in detail what the photo is to optimize the best image generation — subject, age/ethnicity/build, setting, lighting, camera angle, action)
On Screen Text: (describe what the text says in quotations, and describe how the text font, features, and coloring is, e.g. "Bold white text with a black outline and an orange hued glow with a text bubble surrounding it reading \"...\"")

Production Specs: 
-Dimensions & Format: 1080x1350, 4:5 portrait (Instagram / Facebook / Threads static post)
-Brand Colors: dark background with subtle orange accents (describe colors without numbers with how the coloring looks and how it is transposed)
-Logos & Other Branding: use match-fit.net for branding guidelines and put the logo in the top right corner cleanly without covering the focal subject
-References: match-fit.net | use image attached for reference
-Rules:
	-All text and important content of the image stays in the top 3/4 of the image
	-ALL TEXT WITHIN THE IMAGE AND UI DETAILS MUST BE COMPLETELY RENDERED WITHOUT ANY "AI SLOP" AND POORLY RENDERED TEXT
=============================================================================================
Carousel Image Format
Slide Number: (Slide 1 of N — repeat full section per slide)
Main Prompt: (describe in detail what the photo is to optimize the best image generation and ensure visual consistency between images)
On Screen Text: (describe what the text says in quotations, and describe how the text font, features, and coloring is)

Production Specs: 
-Dimensions & Format: 1080x1350, 4:5 portrait swipeable carousel (Instagram / Facebook / Threads / TikTok)
-Brand Colors: dark background with orange accents consistent across all slides
-Logos & Other Branding: consistent Match Fit logo placement across slides
-References: match-fit.net | use image attached for reference
-Rules:
	-All text and important content of the images stays in the top 3/4 of the image
	-ALL TEXT WITHIN THE IMAGE AND UI DETAILS MUST BE COMPLETELY RENDERED WITHOUT ANY "AI SLOP" AND POORLY RENDERED TEXT
=============================================================================================
Video Format (Standard / UGC Avatar)
Main Prompt: (describe in detail what the scene is to optimize video generation | include time stamps and what the narrator/avatar will say during each time stamp | organize by scene and describe transitions and style | if UGC: feature official avatar Jordan Blake front-facing in studio)
On Screen Text: (describe what the text says in quotations, and describe how the text font, features, and coloring is | describe how the text shows up in the video)

Production Specs: 
-Dimensions & Format: 1080x1920, 9:16 vertical video (Reels / TikTok / Shorts)
-Brand Colors: dark background with orange accents
-Logos & Other Branding: Match Fit logo in watermark or outro frame
-References: match-fit.net | use image attached for reference (for UGC: reference ${MATCH_FIT_AVATAR_IMAGE_PATH})
-Rules:
	-All text and important content of the video stays in the top 3/4 of the image
	-ALL TEXT WITHIN THE IMAGE AND UI DETAILS MUST BE COMPLETELY RENDERED WITHOUT ANY "AI SLOP" AND POORLY RENDERED TEXT
=============================================================================================
Cinematic Trailer Video Format
Main Prompt: (describe in detail the high-production cinematic movie-trailer style video | dramatic high-contrast lighting, athlete/trainer action cuts, dynamic camera motion, epic soundtrack cues, time stamps, narrator voiceover script, fast-paced editorial transitions pushing Match Fit)
On Screen Text: (describe high-impact bold typography titles, timed appearances, subtle orange glow, cinematic title cards)

Production Specs: 
-Dimensions & Format: 1080x1920, 9:16 vertical video (Reels / TikTok / Shorts)
-Brand Colors: deep cinematic dark #07080C with fiery #FF7E00 orange highlights and lens flares
-Logos & Other Branding: Match Fit animated logo reveal in outro end card
-References: match-fit.net
-Rules:
	-All key action and title safe content stays in the top 3/4 of the frame
	-ALL TEXT AND MOTION GRAPHICS COMPLETELY RENDERED WITHOUT AI SLOP
`;
