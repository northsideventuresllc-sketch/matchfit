import "server-only";

import { prisma } from "@/lib/prisma";
import {
  fetchRecentOutreachNiBrainLearnings,
  recordOutreachNiBrainLearning,
} from "@/lib/outreach-ni-brain-learning";
import { OUTREACH_CRAFT_LOCK_RULES } from "@/lib/outreach-templates";
import type { OutreachLeadProfileSnapshot, OutreachPlatform } from "@/lib/outreach-types";

export async function recordOutreachEditSignal(args: {
  platform: OutreachPlatform;
  leadId: string;
  adminId: string;
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
      adminId: args.adminId,
      originalText: args.originalText.slice(0, 8000),
      editedText: args.editedText.slice(0, 8000),
      metaJson: JSON.stringify({ field: args.field }),
    },
  });
  await recordOutreachNiBrainLearning({
    signalType: "EDIT_DIFF",
    platform: args.platform,
    leadId: args.leadId,
    adminId: args.adminId,
    originalText: args.originalText,
    editedText: args.editedText,
    meta: { field: args.field },
  });
}

export async function recordOutreachDeleteReasonSignal(args: {
  platform: OutreachPlatform;
  leadId: string;
  adminId: string;
  reason: string;
  profile: OutreachLeadProfileSnapshot;
}): Promise<void> {
  const profileSummary = summarizeLeadProfile(args.profile);
  await prisma.outreachLearningSignal.create({
    data: {
      platform: args.platform,
      signalType: "DELETE_REASON",
      leadId: args.leadId,
      adminId: args.adminId,
      editedText: args.reason.slice(0, 8000),
      metaJson: JSON.stringify({ profile: args.profile, profileSummary }),
    },
  });
  await recordOutreachNiBrainLearning({
    signalType: "DELETE_REASON",
    platform: args.platform,
    leadId: args.leadId,
    adminId: args.adminId,
    editedText: `${args.reason} | Profile: ${profileSummary}`,
    meta: { profile: args.profile },
  });
}

export async function recordOutreachSavedToHubSignal(args: {
  platform: OutreachPlatform;
  leadId: string;
  adminId: string;
  profile: OutreachLeadProfileSnapshot;
}): Promise<void> {
  const profileSummary = summarizeLeadProfile(args.profile);
  await prisma.outreachLearningSignal.create({
    data: {
      platform: args.platform,
      signalType: "SAVED_TO_HUB",
      leadId: args.leadId,
      adminId: args.adminId,
      editedText: profileSummary,
      metaJson: JSON.stringify({ profile: args.profile }),
    },
  });
  await recordOutreachNiBrainLearning({
    signalType: "SAVED_TO_HUB",
    platform: args.platform,
    leadId: args.leadId,
    adminId: args.adminId,
    editedText: profileSummary,
    meta: { profile: args.profile },
  });
}

export async function recordOutreachDeadLeadSignal(args: {
  platform: OutreachPlatform;
  leadId: string;
  adminId: string;
  profile: OutreachLeadProfileSnapshot;
}): Promise<void> {
  const profileSummary = summarizeLeadProfile(args.profile);
  await prisma.outreachLearningSignal.create({
    data: {
      platform: args.platform,
      signalType: "DEAD_LEAD_PATTERN",
      leadId: args.leadId,
      adminId: args.adminId,
      editedText: profileSummary,
      metaJson: JSON.stringify({ profile: args.profile }),
    },
  });
  await recordOutreachNiBrainLearning({
    signalType: "DEAD_LEAD_PATTERN",
    platform: args.platform,
    leadId: args.leadId,
    adminId: args.adminId,
    editedText: profileSummary,
    meta: { profile: args.profile },
  });
}

export async function recordOutreachRegenerateFeedbackSignal(args: {
  platform: OutreachPlatform;
  leadId: string;
  adminId: string;
  field: string;
  feedback: string;
  previousText: string;
}): Promise<void> {
  await prisma.outreachLearningSignal.create({
    data: {
      platform: args.platform,
      signalType: "REGENERATE_FEEDBACK",
      leadId: args.leadId,
      adminId: args.adminId,
      originalText: args.previousText.slice(0, 8000),
      editedText: args.feedback.slice(0, 8000),
      metaJson: JSON.stringify({ field: args.field }),
    },
  });
  await recordOutreachNiBrainLearning({
    signalType: "REGENERATE_FEEDBACK",
    platform: args.platform,
    leadId: args.leadId,
    adminId: args.adminId,
    originalText: args.previousText,
    editedText: args.feedback,
    meta: { field: args.field },
  });
}

export async function recordOutreachOutcomeSignal(args: {
  platform: OutreachPlatform;
  leadId: string;
  adminId?: string;
  outcome: "positive" | "neutral" | "negative" | "no_response";
  notes?: string;
}): Promise<void> {
  await prisma.outreachLearningSignal.create({
    data: {
      platform: args.platform,
      signalType: "OUTCOME",
      leadId: args.leadId,
      adminId: args.adminId ?? null,
      outcome: args.outcome,
      metaJson: args.notes ? JSON.stringify({ notes: args.notes }) : null,
    },
  });
}

export async function buildOutreachLearningContext(
  platform: OutreachPlatform,
  adminId: string,
): Promise<string> {
  try {
    const adminFilter = { adminId };
    const [edits, deleteReasons, savedProfiles, deadPatterns, outcomes, niBrainLines] =
      await Promise.all([
        prisma.outreachLearningSignal.findMany({
          where: { platform, signalType: "EDIT_DIFF", ...adminFilter },
          orderBy: { createdAt: "desc" },
          take: 12,
          select: { originalText: true, editedText: true, metaJson: true },
        }),
        prisma.outreachLearningSignal.findMany({
          where: { platform, signalType: "DELETE_REASON", ...adminFilter },
          orderBy: { createdAt: "desc" },
          take: 8,
          select: { editedText: true, metaJson: true },
        }),
        prisma.outreachLearningSignal.findMany({
          where: { platform, signalType: "SAVED_TO_HUB", ...adminFilter },
          orderBy: { createdAt: "desc" },
          take: 10,
          select: { editedText: true, metaJson: true },
        }),
        prisma.outreachLearningSignal.findMany({
          where: { platform, signalType: "DEAD_LEAD_PATTERN", ...adminFilter },
          orderBy: { createdAt: "desc" },
          take: 10,
          select: { editedText: true, metaJson: true },
        }),
        prisma.outreachLearningSignal.findMany({
          where: { platform, signalType: "OUTCOME", ...adminFilter },
          orderBy: { createdAt: "desc" },
          take: 20,
          select: { outcome: true, leadId: true },
        }),
        fetchRecentOutreachNiBrainLearnings(adminId, 8),
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

    const deleteNotes = deleteReasons
      .slice(0, 4)
      .map((d, i) => `${i + 1}. Avoid: ${truncate(d.editedText, 140)}`)
      .join("\n");

    const savedNotes = summarizeProfilePatterns(savedProfiles);
    const deadNotes = summarizeProfilePatterns(deadPatterns, "Dead lead patterns to avoid");

    const niBrainSection =
      niBrainLines.length > 0
        ? `- NI Brain operator memory:\n${niBrainLines.map((l) => `  • ${l}`).join("\n")}`
        : "";

    return [
      `Learning summary for ${platform} (admin ${adminId.slice(0, 6)}):`,
      OUTREACH_CRAFT_LOCK_RULES,
      `- Responses: ${positive} positive, ${negative} negative, ${noResponse} no response (recent sample).`,
      editNotes ? `- Recent operator edits (match this tone — these override generic AI defaults):\n${editNotes}` : "- No recent copy edits logged yet.",
      deleteNotes ? `- Deleted lead reasons (do not repeat):\n${deleteNotes}` : "",
      savedNotes ? `- Saved lead profile patterns (generate more like these):\n${savedNotes}` : "",
      deadNotes ? `- ${deadNotes}` : "",
      niBrainSection,
      "- Personalize the opening hook every time; keep the generic Match Fit invite tail consistent within the batch.",
      "- IG DMs under 1,000 characters; email under 150 words; Facebook posts use emoji sparingly.",
      "- When operator edits conflict with prior AI copy, prefer the operator edit tone and phrasing.",
    ]
      .filter(Boolean)
      .join("\n");
  } catch (e) {
    console.warn("[outreach-learning] Could not load learning context:", e);
    return [
      `Learning summary for ${platform}:`,
      OUTREACH_CRAFT_LOCK_RULES,
      "- No recent copy edits logged yet.",
      "- Personalize the opening hook every time; keep the generic Match Fit invite tail consistent within the batch.",
    ].join("\n");
  }
}

function summarizeLeadProfile(profile: OutreachLeadProfileSnapshot): string {
  const parts = [
    profile.handle ? `@${profile.handle.replace(/^@/, "")}` : null,
    profile.pageName,
    profile.name,
    profile.email,
    profile.niche ? `niche: ${profile.niche}` : null,
    profile.targetGroup ? `group: ${profile.targetGroup}` : null,
    profile.likelihoodScore != null ? `score: ${profile.likelihoodScore}` : null,
    profile.status ? `status: ${profile.status}` : null,
    profile.whyMatchFit ? `why: ${truncate(profile.whyMatchFit, 120)}` : null,
  ].filter(Boolean);
  return parts.join(" · ");
}

function summarizeProfilePatterns(
  rows: { editedText: string | null; metaJson: string | null }[],
  label = "Saved profile patterns",
): string {
  const niches = new Map<string, number>();
  const groups = new Map<string, number>();
  for (const row of rows) {
    if (row.editedText) {
      const nicheMatch = /niche: ([^·]+)/.exec(row.editedText);
      if (nicheMatch) niches.set(nicheMatch[1].trim(), (niches.get(nicheMatch[1].trim()) ?? 0) + 1);
      const groupMatch = /group: ([^·]+)/.exec(row.editedText);
      if (groupMatch) groups.set(groupMatch[1].trim(), (groups.get(groupMatch[1].trim()) ?? 0) + 1);
    }
  }
  const nicheTop = [...niches.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  const groupTop = [...groups.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2);
  const lines: string[] = [];
  if (nicheTop.length) lines.push(`Top niches: ${nicheTop.map(([n, c]) => `${n} (${c})`).join(", ")}`);
  if (groupTop.length) lines.push(`Target groups: ${groupTop.map(([g, c]) => `${g} (${c})`).join(", ")}`);
  rows.slice(0, 3).forEach((r, i) => {
    if (r.editedText) lines.push(`${i + 1}. ${truncate(r.editedText, 100)}`);
  });
  return lines.length ? `${label}:\n${lines.map((l) => `  • ${l}`).join("\n")}` : "";
}

function truncate(s: string | null, max: number): string {
  if (!s) return "";
  const t = s.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}
