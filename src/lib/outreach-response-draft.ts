import "server-only";

import { callMatchFitAi } from "@/lib/ai-vault/router";
import { getAiVaultStatus } from "@/lib/ai-vault";
import { normalizeCoachLanguage } from "@/lib/content-calendar/content-rules";
import { buildOutreachLearningContext } from "@/lib/outreach-learning";
import { OUTREACH_BRAND_FACTS } from "@/lib/outreach-templates";
import type { OutreachPlatform } from "@/lib/outreach-types";
import { prisma } from "@/lib/prisma";

const ANTHROPIC_OUTREACH_TIMEOUT_MS = 120_000;

type LeadForDraft = {
  displayName: string;
  niche: string | null;
  whyMatchFit: string;
  lastOutbound: string;
};

async function loadLeadForDraft(
  platform: OutreachPlatform,
  id: string,
): Promise<LeadForDraft | null> {
  if (platform === "instagram") {
    const r = await prisma.outreachInstagramLead.findUnique({ where: { id } });
    if (!r) return null;
    return { displayName: r.handle, niche: r.niche, whyMatchFit: r.whyMatchFit, lastOutbound: r.dmText };
  }
  if (platform === "facebook") {
    const r = await prisma.outreachFacebookLead.findUnique({ where: { id } });
    if (!r) return null;
    return { displayName: r.pageName, niche: r.niche, whyMatchFit: r.whyMatchFit, lastOutbound: r.pagePostText };
  }
  if (platform === "email") {
    const r = await prisma.outreachEmailLead.findUnique({ where: { id } });
    if (!r) return null;
    return {
      displayName: r.name,
      niche: r.niche,
      whyMatchFit: r.whyMatchFit,
      lastOutbound: `Subject: ${r.emailSubject}\n\n${r.emailBody}`,
    };
  }
  return null;
}

function persistDraft(platform: OutreachPlatform, id: string, draft: string, now: Date) {
  const data = { pendingResponseDraft: draft, pendingResponseDraftAt: now };
  if (platform === "instagram") return prisma.outreachInstagramLead.update({ where: { id }, data });
  if (platform === "facebook") return prisma.outreachFacebookLead.update({ where: { id }, data });
  return prisma.outreachEmailLead.update({ where: { id }, data });
}

function fallbackDraft(lead: LeadForDraft): string {
  return `Hey — great to hear back from you! Happy to answer anything about Match Fit and how the founding ${
    lead.niche ?? "coach"
  } roster works. Want me to send over the quick details? — JB`;
}

/**
 * Generates (or regenerates) the pending-response reply draft for a lead that has an inbound
 * reply, writing it to `pendingResponseDraft` / `pendingResponseDraftAt`. Uses the AI Vault
 * creative chain (Claude → Gemini …); falls back to a safe template when the Vault is unconfigured.
 */
export async function generateOutreachResponseDraft(args: {
  platform: OutreachPlatform;
  leadId: string;
  adminId: string;
  /** The inbound reply text, when captured by the scan. */
  incomingMessage?: string;
}): Promise<string> {
  const lead = await loadLeadForDraft(args.platform, args.leadId);
  if (!lead) throw new Error("Lead not found.");

  const learning = await buildOutreachLearningContext(args.platform, args.adminId).catch(() => "");
  const system = [
    "You write Match Fit reply drafts to fitness professionals who responded to our outreach.",
    "Warm, human, concise. Advance the conversation toward the founding-coach offer without being pushy.",
    "Say Coaches (not trainers) in copy. CTA when relevant: match-fit.net/trainer/sign-up.",
    OUTREACH_BRAND_FACTS,
    learning ? `Recent learning:\n${learning}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const user = [
    `Lead: ${lead.displayName}`,
    lead.niche ? `Niche: ${lead.niche}` : "",
    `Why they fit: ${lead.whyMatchFit}`,
    `Our last outbound message:\n${lead.lastOutbound || "(none on file)"}`,
    args.incomingMessage?.trim()
      ? `Their reply:\n${args.incomingMessage.trim()}`
      : "Their reply was positive/interested (exact text not captured).",
    "",
    `Write ONLY the reply draft for the ${args.platform} channel — no labels or explanation.`,
  ]
    .filter(Boolean)
    .join("\n");

  const now = new Date();
  let draft = fallbackDraft(lead);

  if (getAiVaultStatus().configured) {
    try {
      const ai = await callMatchFitAi({
        system,
        user,
        maxTokens: 1200,
        temperature: 0.4,
        timeoutMs: ANTHROPIC_OUTREACH_TIMEOUT_MS,
        kind: "creative",
        complexity: "standard",
        modelOverride: process.env.ANTHROPIC_OUTREACH_MODEL?.trim() || undefined,
      });
      if (ai.text?.trim()) draft = ai.text.trim();
    } catch (e) {
      console.warn("[outreach-response-draft] AI generation failed, using fallback", e);
    }
  }

  draft = normalizeCoachLanguage(draft);
  await persistDraft(args.platform, args.leadId, draft, now);
  return draft;
}
