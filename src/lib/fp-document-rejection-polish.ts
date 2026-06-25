import type { FpDocType } from "@/lib/fp-account-tier-types";
import { FP_DOC_TYPE_LABELS } from "@/lib/fp-tier-docs";
import { callMatchFitAi } from "@/lib/ai-vault/router";
import { getAiVaultStatus } from "@/lib/ai-vault";

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

  const docLabel = FP_DOC_TYPE_LABELS[input.docType];

  if (!getAiVaultStatus().configured) {
    return `Your ${docLabel.toLowerCase()} could not be approved: ${basicPolish(raw)}`;
  }

  try {
    const ai = await callMatchFitAi({
      system:
        "You rewrite internal staff notes into one professional, empathetic sentence for a fitness professional email. Use plain English, no jargon, no blame. Return JSON: { polished: string }.",
      user: JSON.stringify({
        documentLabel: docLabel,
        staffNote: raw.slice(0, 1200),
      }),
      maxTokens: 300,
      temperature: 0.2,
      jsonMode: true,
      kind: "classification",
      complexity: "simple",
    });
    const text = ai.text?.trim();
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
