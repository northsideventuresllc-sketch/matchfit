import { queueChatAdminReview } from "@/lib/chat-admin-review-queue";
import { scanChatTextForLeakageSignals } from "@/lib/chat-leakage-detection";

type ChatAuthor = "CLIENT" | "TRAINER";

/** Keyword / phrase heuristics beyond payment-contact leakage (ToS / safety). */
function collectPolicyHeuristicSignals(raw: string): string[] {
  const lower = raw.toLowerCase();
  const out: string[] = [];
  const add = (label: string) => {
    if (!out.includes(label)) out.push(label);
  };

  if (/\b(whatsapp|telegram|signal|snapchat|discord)\b/i.test(raw)) add("OFF_PLATFORM_MESSAGING_APP");
  if (/\b(instagram|ig)\b.*\b(dm|message me)\b/i.test(lower) || /\bdm\s+me\b/i.test(lower)) add("OFF_PLATFORM_SOCIAL_DM");
  if (/\b(pay|payment).{0,40}\b(outside|off[-\s]?platform|under the table|cash only|direct)\b/i.test(lower)) {
    add("SUSPECTED_OFF_PLATFORM_PAYMENT");
  }
  if (/\b(meet|meetup).{0,50}\b(off|outside).{0,30}\b(platform|app|match fit)\b/i.test(lower)) add("SUSPECTED_OFF_PLATFORM_MEETING");
  if (/\b(nude|nudes|explicit|sexual)\b/i.test(lower) && raw.length < 800) add("SUSPECTED_SEXUAL_CONTENT");
  if (/\b(minor|underage|high school)\b/i.test(lower)) add("SUSPECTED_MINORS_REFERENCE");

  return out;
}

type OpenAiComplianceShape = {
  report?: boolean;
  /** Short machine tags, e.g. harassment, scams, self_harm */
  tags?: string[];
};

/**
 * Optional OpenAI pass: flags content that may violate Terms, Privacy, or safety rules.
 * When no API key is configured, returns an empty list (heuristics + leakage still run).
 */
async function collectOpenAiComplianceSignals(body: string): Promise<string[]> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key || body.length > 6000) return [];

  const model = process.env.OPENAI_CHAT_COMPLIANCE_MODEL?.trim() || "gpt-4o-mini";
  const payload = {
    model,
    temperature: 0.1,
    response_format: { type: "json_object" as const },
    messages: [
      {
        role: "system" as const,
        content:
          "You are a trust-and-safety classifier for a US fitness coaching marketplace (Match Fit). " +
          "Messages must follow the platform Terms of Service and Privacy Policy: no off-platform payment, " +
          "no steering users to unmonitored channels to evade fees, no harassment, scams, sexual content involving minors, " +
          "or instructions for self-harm. Be conservative: only set report=true when there is a realistic policy or safety concern. " +
          "Respond with JSON only: {\"report\": boolean, \"tags\": string[]}. " +
          "Use lowercase snake_case tags (max 6). If report is false, tags must be [].",
      },
      {
        role: "user" as const,
        content: body.slice(0, 4000),
      },
    ],
  };

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return [];
    const raw = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = raw.choices?.[0]?.message?.content?.trim();
    if (!text) return [];
    const parsed = JSON.parse(text) as OpenAiComplianceShape;
    if (!parsed.report) return [];
    const tags = Array.isArray(parsed.tags) ? parsed.tags.filter((t) => typeof t === "string" && t.trim()) : [];
    const normalized = tags.slice(0, 6).map((t) => `AI_TAG:${t.trim().slice(0, 48)}`);
    return normalized.length ? ["AI_POLICY_REVIEW", ...normalized] : ["AI_POLICY_REVIEW"];
  } catch {
    return [];
  }
}

/** Merges payment/PII leakage scan, policy heuristics, and optional AI review; queues human review when anything matches. */
export async function runOutboundChatComplianceMonitoring(args: {
  conversationId: string;
  authorRole: ChatAuthor;
  body: string;
}): Promise<void> {
  const signals = new Set<string>();
  const leak = scanChatTextForLeakageSignals(args.body);
  leak.signals.forEach((s) => signals.add(s));
  collectPolicyHeuristicSignals(args.body).forEach((s) => signals.add(s));
  const aiSignals = await collectOpenAiComplianceSignals(args.body);
  aiSignals.forEach((s) => signals.add(s));

  if (signals.size === 0) return;
  await queueChatAdminReview({
    conversationId: args.conversationId,
    authorRole: args.authorRole,
    signals: [...signals],
    body: args.body,
  });
}
