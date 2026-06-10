import "server-only";

import { prisma } from "@/lib/prisma";
import type { OutreachPlatform } from "@/lib/outreach-types";

export async function recordOutreachEditSignal(args: {
  platform: OutreachPlatform;
  leadId: string;
  field: string;
  originalText: string;
  editedText: string;
}): Promise<void> {
  if (args.originalText.trim() === args.editedText.trim()) return;
  await prisma.outreachLearningSignal.create({
    data: {
      platform: args.platform,
      signalType: "EDIT_DIFF",
      leadId: args.leadId,
      originalText: args.originalText.slice(0, 8000),
      editedText: args.editedText.slice(0, 8000),
      metaJson: JSON.stringify({ field: args.field }),
    },
  });
}

export async function recordOutreachOutcomeSignal(args: {
  platform: OutreachPlatform;
  leadId: string;
  outcome: "positive" | "neutral" | "negative" | "no_response";
  notes?: string;
}): Promise<void> {
  await prisma.outreachLearningSignal.create({
    data: {
      platform: args.platform,
      signalType: "OUTCOME",
      leadId: args.leadId,
      outcome: args.outcome,
      metaJson: args.notes ? JSON.stringify({ notes: args.notes }) : null,
    },
  });
}

export async function buildOutreachLearningContext(platform: OutreachPlatform): Promise<string> {
  try {
    const [edits, outcomes] = await Promise.all([
      prisma.outreachLearningSignal.findMany({
        where: { platform, signalType: "EDIT_DIFF" },
        orderBy: { createdAt: "desc" },
        take: 12,
        select: { originalText: true, editedText: true, metaJson: true },
      }),
      prisma.outreachLearningSignal.findMany({
        where: { platform, signalType: "OUTCOME" },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { outcome: true, leadId: true },
      }),
    ]);

    const positive = outcomes.filter((o) => o.outcome === "positive").length;
    const negative = outcomes.filter((o) => o.outcome === "negative").length;
    const noResponse = outcomes.filter((o) => o.outcome === "no_response").length;

    const editNotes = edits
      .slice(0, 5)
      .map((e, i) => {
        const field = e.metaJson ? (JSON.parse(e.metaJson) as { field?: string }).field : "text";
        return `${i + 1}. Operator edited ${field ?? "copy"} — prefer tone closer to: "${truncate(e.editedText, 120)}"`;
      })
      .join("\n");

    return [
      `Learning summary for ${platform}:`,
      `- Responses: ${positive} positive, ${negative} negative, ${noResponse} no response (recent sample).`,
      editNotes ? `- Recent operator edits (match this tone):\n${editNotes}` : "- No recent copy edits logged yet.",
      "- Personalize the opening hook every time; keep the generic Match Fit invite tail consistent within the batch.",
      "- IG DMs under 1,000 characters; email under 150 words; Facebook posts use emoji sparingly.",
    ].join("\n");
  } catch (e) {
    console.warn("[outreach-learning] Could not load learning context:", e);
    return [
      `Learning summary for ${platform}:`,
      "- No recent copy edits logged yet.",
      "- Personalize the opening hook every time; keep the generic Match Fit invite tail consistent within the batch.",
    ].join("\n");
  }
}

function truncate(s: string | null, max: number): string {
  if (!s) return "";
  const t = s.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}
