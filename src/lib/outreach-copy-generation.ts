import "server-only";

import { hydratePlatformEnvFromDatabase } from "@/lib/hydrate-platform-env";
import { getAdminAiProviderStatus } from "@/lib/admin-analytics-ai";
import type { AdminAiProviderId } from "@/lib/admin-analytics-ai";
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

function resolveOutreachAiModel(provider: AdminAiProviderId): string {
  if (provider === "anthropic") {
    return (
      process.env.ANTHROPIC_OUTREACH_MODEL?.trim() ||
      process.env.ANTHROPIC_ADMIN_ANALYTICS_MODEL?.trim() ||
      "claude-3-7-sonnet-20250219"
    );
  }
  return process.env.OPENAI_OUTREACH_MODEL?.trim() || "gpt-4o";
}

async function callOutreachCopyAi(system: string, user: string): Promise<string | null> {
  await hydratePlatformEnvFromDatabase();
  const status = getAdminAiProviderStatus();
  if (!status.configured) return null;

  if (status.provider === "anthropic" && process.env.ANTHROPIC_API_KEY) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: resolveOutreachAiModel("anthropic"),
        max_tokens: 2048,
        system,
        messages: [{ role: "user", content: user }],
      }),
      signal: AbortSignal.timeout(ANTHROPIC_OUTREACH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { content?: { type: string; text?: string }[] };
    const text = data.content?.find((b) => b.type === "text")?.text?.trim();
    return text ?? null;
  }

  if (process.env.OPENAI_API_KEY) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: resolveOutreachAiModel("openai"),
        max_tokens: 2048,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
      signal: AbortSignal.timeout(90_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return data.choices?.[0]?.message?.content?.trim() ?? null;
  }

  return null;
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
    return `Write the complete, natural ${fieldLabel(field)} for Match Fit outreach to @${handle}.

LEAD RESEARCH & CONTEXT:
- Handle: @${handle}
- Niche: ${lead.niche}
- Why they fit: ${lead.whyMatchFit}
- Specific hook / content research: ${hook}

CRITICAL RULES:
- Write a seamless, natural, conversational message as JB (Jonny), founder of Match Fit.
- NEVER include numbers (1., 2., 3.), step labels (e.g. "Greeting:", "Intro:", "CTA:"), or bracketed template tags in the output.
- You must synthesize the lead research into an authentic, personalized message following this narrative flow:
  • Casual greeting: Hey @${handle} 👋
  • Genuine, individualized compliment about their specific brand/content (${hook}) and how it aligns with Match Fit
  • Introduce Match Fit (match-fit.net) and yourself as JB, the founder
  • Low-friction initial check-in (e.g. "Worth taking a quick look?")
  • Explain the founding virtual coach cohort: 60 days free trial, 0 platform/listing fees upfront, priority athlete discovery feed
  • Reiterate the CTA and warmly open the door for questions (e.g. "If you have any questions or want to see how listing works, feel free to reach back out!")
  • Direct frictionless sign-up link: match-fit.net/trainer/sign-up

Output ONLY the raw message ready to send. No preamble, no postamble, no numbered layout list.${feedbackBlock}`;
  }

  if (platform === "instagram" && field === "commentText") {
    return `Write a short Instagram comment (${fieldLabel(field)}) for ${lead.handle}.
Post to comment on: ${lead.commentPostRef ?? "latest post"}
Why they fit: ${lead.whyMatchFit}
Hook context: ${hook}

Keep it 1-2 sentences, specific to their content, friendly, not salesy. Return ONLY the comment text.${feedbackBlock}`;
  }

  if (platform === "instagram" && field === "followUp1DmText") {
    return `Write a short 2-4 sentence ${fieldLabel(field)} for ${lead.handle} who did not reply to the first DM.
Why they fit: ${lead.whyMatchFit}
First DM (if any): ${lead.dmText || "(not drafted yet)"}

Point back to the founding coach spots on Match Fit with 60 days free and leave the sign-up link (match-fit.net/trainer/sign-up). Friendly, polite bump from JB. Return ONLY the natural DM text with no template labels or numbers.${feedbackBlock}`;
  }

  if (platform === "instagram" && field === "followUp2DmText") {
    return `Write a brief 2-3 sentence ${fieldLabel(field)} for ${lead.handle} — last polite check-in before moving on.
Why they fit: ${lead.whyMatchFit}

Close the loop respectfully, wishing them continued success, with a final mention of Match Fit founding roster. Sign as JB. Return ONLY the natural DM text with no template labels or numbers.${feedbackBlock}`;
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
    return `Write the complete, natural ${fieldLabel(field)} to ${first} at ${lead.email}.

LEAD RESEARCH & CONTEXT:
- Name: ${lead.name}
- Email: ${lead.email}
- Business/Niche: ${lead.niche ?? "Fitness Coaching"}
- Why they fit: ${lead.whyMatchFit}
- Specific hook / content research: ${hook}

CRITICAL RULES:
- Write a seamless, natural email from JB (Jonny), founder of Match Fit.
- NEVER include numbers (1., 2., 3.), step labels (e.g. "Greeting:", "Promo explanation:", "CTA:"), or bracketed template tags in the output.
- You must synthesize the lead research into an authentic, personalized email following this narrative flow:
  • Greeting: Hi ${first},
  • Specific, individualized compliment about their coaching business/brand (${hook}) and why Match Fit is an ideal fit
  • Founder introduction: introduce what Match Fit (match-fit.net) is and who I am (JB, founder)
  • Low-friction initial CTA (e.g. "Open to taking a quick look?")
  • Promo explanation: founding virtual fitness coach roster with 60 days free, zero platform/listing fees upfront, automated booking and client payments
  • Secondary CTA + open door for questions (e.g. "If you have any questions or want to see how listing works, feel free to reply!")
  • Direct sign-up link: match-fit.net/trainer/sign-up
  • Sign-off: — JB

Output ONLY the raw email body text ready to send. No preamble, no postamble, no numbered layout list.${feedbackBlock}`;
  }

  if (platform === "email" && field === "followUp1EmailSubject") {
    return `Write the ${fieldLabel(field)} for ${lead.name}. Return ONLY the subject.${feedbackBlock}`;
  }

  if (platform === "email" && field === "followUp1EmailBody") {
    const first = String(lead.name ?? "there").split(" ")[0];
    return `Write a short 2-4 sentence ${fieldLabel(field)} to ${first}.
Reference the founding coach roster on Match Fit (60 days free, automated payments/booking), point back to the original email, and leave the sign-up link (match-fit.net/trainer/sign-up). Open the door for questions. Sign as JB. Return ONLY the natural email body with no template labels or numbers.${feedbackBlock}`;
  }

  if (platform === "email" && field === "followUp2EmailSubject") {
    return `Write the ${fieldLabel(field)} for ${lead.name}. Return ONLY the subject.${feedbackBlock}`;
  }

  if (platform === "email" && field === "followUp2EmailBody") {
    const first = String(lead.name ?? "there").split(" ")[0];
    return `Write a brief 2-3 sentence ${fieldLabel(field)} to ${first}.
Closing the loop on founding coach spots, wishing them the best with their training business. Sign as JB. Return ONLY the natural email body with no template labels or numbers.${feedbackBlock}`;
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
