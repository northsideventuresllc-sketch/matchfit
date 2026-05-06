import { MATCH_SERVICE_CATALOG, type MatchServiceId } from "@/lib/trainer-match-questionnaire";

export type CheckoutHintPick = {
  serviceId: string;
  title: string;
  /** 0–1, sums to ~1 across returned picks */
  probability: number;
};

export type TrainerCheckoutHint =
  | {
      show: false;
      dismissToken: string;
    }
  | {
      show: true;
      dismissToken: string;
      mode: "single" | "pick_three";
      picks: CheckoutHintPick[];
    };

type Msg = { authorRole: string; body: string };

const STRONG_INTENT =
  /\b(send (me )?(the )?link|checkout|pay(ment)?|how do i pay|credit card|debit card|invoice|ready to (start|buy|purchase|sign up|commit)|sign me up|lock (it|this) in|book (it|now)|purchase|subscribe here)\b/i;

const MEDIUM_INTENT =
  /\b(price|pricing|cost|how much|rate|rates|quote|package|session pack|monthly|per session|program fee|what('s| is) (the )?(total|fee))\b/i;

const SERVICE_HINT_WORDS: Partial<Record<MatchServiceId, readonly string[]>> = {
  one_on_one_pt: ["personal training", "one on one", "1:1", "private session", "pt session", "trainer session"],
  small_group: ["small group", "group class", "group training", "buddy"],
  nutrition_coaching: ["nutrition", "diet", "macros", "meal plan", "eating", "accountability food"],
  online_program: ["online program", "plan only", "workout plan", "program design", "diy", "self guided"],
  sports_specific: ["sport", "athletic", "performance", "season", "team"],
  mobility_recovery: ["mobility", "recovery", "stretch", "flexibility", "injury", "rehab"],
  hiit_conditioning: ["hiit", "conditioning", "cardio blast", "metcon"],
  yoga_pilates_style: ["yoga", "pilates", "mind body", "breathwork"],
};

function normalizeWords(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter((w) => w.length > 2);
}

function catalogLabel(id: string): string {
  const row = MATCH_SERVICE_CATALOG.find((c) => c.id === id);
  return row?.label ?? id;
}

function clientHaystack(messages: Msg[], maxMessages: number): string {
  const clientBodies = messages
    .filter((m) => m.authorRole === "CLIENT")
    .slice(-maxMessages)
    .map((m) => m.body)
    .join("\n");
  return clientBodies.toLowerCase();
}

function hasCheckoutIntent(haystack: string): boolean {
  if (!haystack.trim()) return false;
  if (STRONG_INTENT.test(haystack)) return true;
  const mediumTokens =
    haystack.match(
      /\b(price|pricing|cost|how much|rate|rates|quote|package|session pack|monthly|per session|program fee|total|fee)\b/gi,
    ) ?? [];
  if (mediumTokens.length >= 2) return true;
  if (
    MEDIUM_INTENT.test(haystack) &&
    /\b(i'?m ready|let'?s do (this|it)|sign me up|get started|move forward|sounds good|let'?s go)\b/i.test(haystack)
  ) {
    return true;
  }
  return false;
}

function scoreService(serviceId: string, title: string, haystack: string): number {
  let score = 0;
  const label = catalogLabel(serviceId).toLowerCase();
  const blob = `${title.toLowerCase()} ${label} ${serviceId.replace(/_/g, " ")}`;
  const words = new Set(normalizeWords(blob));

  for (const w of words) {
    if (w.length > 3 && haystack.includes(w)) score += 1.2;
  }

  const hints = SERVICE_HINT_WORDS[serviceId as MatchServiceId];
  if (hints) {
    for (const phrase of hints) {
      if (haystack.includes(phrase)) score += 2.5;
    }
  }

  return score;
}

function softmax(weights: number[]): number[] {
  if (weights.length === 0) return [];
  const max = Math.max(...weights);
  const exps = weights.map((w) => Math.exp(Math.min(20, w - max)));
  const sum = exps.reduce((a, b) => a + b, 0);
  if (sum <= 0) return weights.map(() => 1 / weights.length);
  return exps.map((e) => e / sum);
}

/**
 * Lightweight, deterministic “assistant” signal for when a client message thread
 * suggests sending a Match Fit checkout link. No external API calls.
 */
export function computeTrainerCheckoutHint(args: {
  conversationId: string | null;
  messages: Msg[];
  publishedServices: { serviceId: string; title: string }[];
  /** Latest client message id for dismiss / re-show semantics */
  lastClientMessageId: string | null;
}): TrainerCheckoutHint {
  const { conversationId, messages, publishedServices, lastClientMessageId } = args;
  const baseToken = `${conversationId ?? "none"}:${lastClientMessageId ?? "0"}:${publishedServices.map((s) => s.serviceId).sort().join(",")}`;

  if (publishedServices.length === 0) {
    return { show: false, dismissToken: baseToken };
  }

  const haystack = clientHaystack(messages, 18);
  if (!hasCheckoutIntent(haystack)) {
    return { show: false, dismissToken: baseToken };
  }

  const scored = publishedServices.map((s) => ({
    ...s,
    raw: scoreService(s.serviceId, s.title, haystack),
  }));
  scored.sort((a, b) => b.raw - a.raw);

  const top = scored[0]!;
  const second = scored[1];
  const rawGap = second ? top.raw - second.raw : 999;

  const takeTop = scored.slice(0, Math.min(3, scored.length));
  const weights = takeTop.map((s) => Math.max(0.15, s.raw + 0.01));
  const probs = softmax(weights);

  const picks: CheckoutHintPick[] = takeTop.map((s, i) => ({
    serviceId: s.serviceId,
    title: s.title,
    probability: probs[i] ?? 1 / takeTop.length,
  }));

  const singleEligible =
    publishedServices.length === 1 ||
    (top.raw >= 3.5 && rawGap >= 2) ||
    (top.raw >= 6 && rawGap >= 1);

  if (singleEligible && picks[0]) {
    return {
      show: true,
      dismissToken: baseToken,
      mode: "single",
      picks: [picks[0]],
    };
  }

  return {
    show: true,
    dismissToken: baseToken,
    mode: "pick_three",
    picks,
  };
}
