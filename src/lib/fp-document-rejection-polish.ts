import type { FpDocType } from "@/lib/fp-account-tier-types";
import { FP_DOC_TYPE_LABELS } from "@/lib/fp-tier-docs";

function basicPolish(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (!trimmed) return "";
  const sentence = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  return /[.!?]$/.test(sentence) ? sentence : `${sentence}.`;
}

/**
 * Turns operator denial notes into professional copy for trainer emails.
 * Uses OpenAI when configured; otherwise applies light grammar cleanup.
 */
export async function polishFpDocumentRejectionReason(input: {
  docType: FpDocType;
  rawReason: string;
}): Promise<string> {
  const raw = input.rawReason.trim();
  if (!raw) return "";

  const key = process.env.OPENAI_API_KEY?.trim();
  const docLabel = FP_DOC_TYPE_LABELS[input.docType];

  if (!key) {
    return `Your ${docLabel.toLowerCase()} could not be approved: ${basicPolish(raw)}`;
  }

  const body = {
    model: process.env.OPENAI_FP_DOC_MODEL?.trim() || "gpt-4o-mini",
    temperature: 0.2,
    response_format: { type: "json_object" as const },
    messages: [
      {
        role: "system" as const,
        content:
          "You rewrite internal staff notes into one professional, empathetic sentence for a fitness professional email. Use plain English, no jargon, no blame. Return JSON: { polished: string }.",
      },
      {
        role: "user" as const,
        content: JSON.stringify({
          documentLabel: docLabel,
          staffNote: raw.slice(0, 1200),
        }),
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
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      return `Your ${docLabel.toLowerCase()} could not be approved: ${basicPolish(raw)}`;
    }
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = json.choices?.[0]?.message?.content?.trim();
    if (!text) {
      return `Your ${docLabel.toLowerCase()} could not be approved: ${basicPolish(raw)}`;
    }
    const parsed = JSON.parse(text) as { polished?: string };
    const polished = parsed.polished?.trim();
    if (!polished) {
      return `Your ${docLabel.toLowerCase()} could not be approved: ${basicPolish(raw)}`;
    }
    return polished;
  } catch {
    return `Your ${docLabel.toLowerCase()} could not be approved: ${basicPolish(raw)}`;
  }
}
