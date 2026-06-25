import "server-only";

import { callMatchFitAi } from "@/lib/ai-vault/router";
import { getAiVaultStatus } from "@/lib/ai-vault";
import { buildOutreachLearningContext, recordOutreachRegenerateFeedbackSignal } from "@/lib/outreach-learning";
import { updateOutreachLead } from "@/lib/outreach-data";
import {
  emailSubject,
  followUpEmailBody,
  followUpEmailSubject,
  genericInviteTail,
  instagramPersonalizedOpener,
  OUTREACH_BRAND_FACTS,
} from "@/lib/outreach-templates";
import type { OutreachCopyField, OutreachPlatform } from "@/lib/outreach-types";
import { prisma } from "@/lib/prisma";

const ANTHROPIC_OUTREACH_TIMEOUT_MS = 180_000;

async function callOutreachCopyAi(system: string, user: string): Promise<string | null> {
  const vault = getAiVaultStatus();
  if (!vault.configured) return null;

  const ai = await callMatchFitAi({
    system,
    user,
    maxTokens: 2048,
    temperature: 0.35,
    timeoutMs: ANTHROPIC_OUTREACH_TIMEOUT_MS,
    kind: "creative",
    complexity: "standard",
    modelOverride: process.env.ANTHROPIC_OUTREACH_MODEL?.trim() || undefined,
  });

  return ai.text?.trim() ?? null;
}

function extractHookFromNotes(notes: string | null | undefined): string | null {
  if (!notes) return null;
  const match = /Hook:\s*([^·]+)/.exec(notes);
  return match?.[1]?.trim() ?? null;
}

function fieldLabel(field: OutreachCopyField): string {
  const labels: Record<string, string> = {
    dmText: "first Instagram DM",
    commentText: "Instagram comment to grab attention",
    followUp1DmText: "first follow-up Instagram DM",
    followUp2DmText: "second follow-up Instagram DM",
    pagePostText: "Facebook page or group post",
    emailSubject: "first outreach email subject line",
    emailBody: "first outreach email body",
    followUp1EmailSubject: "first follow-up email subject line",
    followUp1EmailBody: "first follow-up email body",
    followUp2EmailSubject: "second follow-up email subject line",
    followUp2EmailBody: "second follow-up email body",
  };
  return labels[field] ?? field;
}

function buildCopyPrompt(
  platform: OutreachPlatform,
  field: OutreachCopyField,
  lead: Record<string, unknown>,
  feedback?: string,
): string {
  const tail = String(lead.genericInviteTail ?? genericInviteTail(platform, "VIRTUAL"));
  const hook = extractHookFromNotes(lead.notes as string | null) ?? String(lead.whyMatchFit ?? "");
  const feedbackBlock = feedback?.trim()
    ? `\n\nAdmin feedback on the previous version (address this):\n${feedback.trim()}`
    : "";

  if (platform === "instagram" && field === "dmText") {
    const handle = String(lead.handle ?? "").replace(/^@/, "");
    const opener = instagramPersonalizedOpener("VIRTUAL", handle, hook);
    return `Write the ${fieldLabel(field)} for Match Fit outreach to ${lead.handle}.
Why they fit: ${lead.whyMatchFit}
Niche: ${lead.niche}
Personal hook context: ${hook}
Comment target post: ${lead.commentPostRef ?? "latest post"}

Start with this personalized opener tone, then end with this invite tail:
${opener}
[Tail] ${tail}

Return ONLY the final DM text — no labels or explanation.${feedbackBlock}`;
  }

  if (platform === "instagram" && field === "commentText") {
    return `Write a short Instagram comment (${fieldLabel(field)}) for ${lead.handle}.
Post to comment on: ${lead.commentPostRef ?? "latest post"}
Why they fit: ${lead.whyMatchFit}
Hook context: ${hook}

Keep it 1-2 sentences, specific to their content, friendly, not salesy. Return ONLY the comment text.${feedbackBlock}`;
  }

  if (platform === "instagram" && field === "followUp1DmText") {
    return `Write a ${fieldLabel(field)} for ${lead.handle} who did not reply to the first DM.
Why they fit: ${lead.whyMatchFit}
First DM (if any): ${lead.dmText || "(not drafted yet)"}

Friendly bump — mention Match Fit beta roster, not pushy. Return ONLY the DM text.${feedbackBlock}`;
  }

  if (platform === "instagram" && field === "followUp2DmText") {
    return `Write a ${fieldLabel(field)} for ${lead.handle} — last polite check-in before moving on.
Why they fit: ${lead.whyMatchFit}

Brief, respectful close-the-loop message. Return ONLY the DM text.${feedbackBlock}`;
  }

  if (platform === "facebook" && field === "pagePostText") {
    return `Write a ${fieldLabel(field)} introducing Match Fit to trainers on ${lead.pageName}.
Page URL: ${lead.pageUrl}
Why they fit: ${lead.whyMatchFit}
Audience: ${lead.audience ?? "TRAINER"}

End with this tail:
${tail}

Return ONLY the post text.${feedbackBlock}`;
  }

  if (platform === "email" && field === "emailSubject") {
    return `Write the ${fieldLabel(field)} for outreach to ${lead.name} (${lead.email}).
Why they fit: ${lead.whyMatchFit}

Return ONLY the subject line, no quotes.${feedbackBlock}`;
  }

  if (platform === "email" && field === "emailBody") {
    const first = String(lead.name ?? "there").split(" ")[0];
    return `Write the ${fieldLabel(field)} to ${first} at ${lead.email}.
Why they fit: ${lead.whyMatchFit}
Hook: ${hook}

Sign as Jonny, founder of Match Fit. End with:
${tail}

Return ONLY the email body.${feedbackBlock}`;
  }

  if (platform === "email" && field === "followUp1EmailSubject") {
    return `Write the ${fieldLabel(field)} for ${lead.name}. Return ONLY the subject.${feedbackBlock}`;
  }

  if (platform === "email" && field === "followUp1EmailBody") {
    return `Write the ${fieldLabel(field)} to ${lead.name}.
First email subject: ${lead.emailSubject || emailSubject("VIRTUAL")}
Reference Match Fit beta spots. Return ONLY the body.${feedbackBlock}`;
  }

  if (platform === "email" && field === "followUp2EmailSubject") {
    return `Write the ${fieldLabel(field)} for ${lead.name}. Return ONLY the subject.${feedbackBlock}`;
  }

  if (platform === "email" && field === "followUp2EmailBody") {
    const first = String(lead.name ?? "there").split(" ")[0];
    const template = followUpEmailBody(first);
    return `Write the ${fieldLabel(field)} to ${lead.name}.
Use this as tone reference but personalize:
${template}

Return ONLY the body.${feedbackBlock}`;
  }

  return `Write ${fieldLabel(field)} for Match Fit outreach. Return ONLY the copy.${feedbackBlock}`;
}

async function loadLeadRecord(platform: OutreachPlatform, id: string) {
  if (platform === "instagram") {
    return prisma.outreachInstagramLead.findUnique({ where: { id } });
  }
  if (platform === "facebook") {
    return prisma.outreachFacebookLead.findUnique({ where: { id } });
  }
  if (platform === "email") {
    return prisma.outreachEmailLead.findUnique({ where: { id } });
  }
  return null;
}

function fallbackCopy(
  platform: OutreachPlatform,
  field: OutreachCopyField,
  lead: Record<string, unknown>,
): string {
  const tail = String(lead.genericInviteTail ?? genericInviteTail(platform, "VIRTUAL"));
  const hook = extractHookFromNotes(lead.notes as string | null) ?? String(lead.whyMatchFit ?? "");

  if (platform === "instagram" && field === "dmText") {
    const handle = String(lead.handle ?? "").replace(/^@/, "");
    return `${instagramPersonalizedOpener("VIRTUAL", handle, hook)}${tail}`;
  }
  if (platform === "instagram" && field === "commentText") {
    return `Love the coaching you're putting out — especially around ${lead.niche ?? "your niche"} 🔥`;
  }
  if (platform === "instagram" && field === "followUp1DmText") {
    return `Hey — circling back on Match Fit. Still a few beta spots for US trainers if you're open to a quick look. — JB`;
  }
  if (platform === "instagram" && field === "followUp2DmText") {
    return `Last note from me — happy to share more on Match Fit if timing opens up. Either way, keep crushing it. — JB`;
  }
  if (platform === "facebook" && field === "pagePostText") {
    return `👋 US fitness trainers — Match Fit is hand-selecting founding coaches for beta.\n\n${tail}`;
  }
  if (platform === "email" && field === "emailSubject") {
    return emailSubject("VIRTUAL");
  }
  if (platform === "email" && field === "emailBody") {
    const first = String(lead.name ?? "there").split(" ")[0];
    return `Hey ${first},\n\nI'm Jonny, founder of Match Fit. ${hook}\n\n${tail}`;
  }
  if (platform === "email" && field === "followUp1EmailSubject") {
    return followUpEmailSubject();
  }
  if (platform === "email" && field === "followUp1EmailBody") {
    const first = String(lead.name ?? "there").split(" ")[0];
    return `Hey ${first},\n\nFollowing up on Match Fit — still a few beta spots for US trainers. Happy to answer questions.\n\n— Jonny`;
  }
  if (platform === "email" && field === "followUp2EmailSubject") {
    return "Re: Match Fit — closing the loop";
  }
  if (platform === "email" && field === "followUp2EmailBody") {
    return followUpEmailBody(String(lead.name ?? "there"));
  }
  return "";
}

export async function generateOutreachLeadCopy(args: {
  platform: OutreachPlatform;
  leadId: string;
  fields: OutreachCopyField[];
  adminId: string;
  feedback?: string;
}): Promise<Record<string, string>> {
  const lead = await loadLeadRecord(args.platform, args.leadId);
  if (!lead) throw new Error("Lead not found.");

  const learning = await buildOutreachLearningContext(args.platform, args.adminId);
  const system = [
    "You write Match Fit outreach copy for US fitness professionals.",
    OUTREACH_BRAND_FACTS,
    learning ? `Recent learning:\n${learning}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const result: Record<string, string> = {};

  for (const field of args.fields) {
    const existing = (lead as Record<string, unknown>)[field];
    const isRegenerate = typeof existing === "string" && existing.trim().length > 0;

    if (isRegenerate && args.feedback?.trim()) {
      await recordOutreachRegenerateFeedbackSignal({
        platform: args.platform,
        leadId: args.leadId,
        adminId: args.adminId,
        field,
        feedback: args.feedback,
        previousText: String(existing),
      });
    }

    const userPrompt = buildCopyPrompt(args.platform, field, lead as Record<string, unknown>, args.feedback);
    const aiText = await callOutreachCopyAi(system, userPrompt);
    const copy = aiText?.trim() || fallbackCopy(args.platform, field, lead as Record<string, unknown>);
    result[field] = copy;

    await updateOutreachLead(args.platform, args.leadId, { [field]: copy });
  }

  return result;
}
