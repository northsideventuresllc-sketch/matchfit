import "server-only";

import { getAdminAiProviderStatus } from "@/lib/admin-analytics-ai";
import {
  normalizeInstagramLeadIdentity,
  sleepMs,
  verifyInstagramProfile,
} from "@/lib/instagram-profile-verify";
import { buildOutreachLearningContext } from "@/lib/outreach-learning";
import {
  genericInviteTail,
  instagramPersonalizedOpener,
  emailSubject,
  OUTREACH_BRAND_FACTS,
} from "@/lib/outreach-templates";
import type { OutreachPlatform, OutreachTargetGroup } from "@/lib/outreach-types";
import { prisma } from "@/lib/prisma";

export type GeneratedInstagramLead = {
  handle: string;
  profileUrl: string;
  niche: string;
  targetGroup: OutreachTargetGroup;
  whyMatchFit: string;
  likelihoodScore: number;
  personalHook: string;
  dmText: string;
  commentText: string;
  commentPostRef: string;
  notes?: string;
};

export type GeneratedFacebookLead = {
  pageName: string;
  pageUrl: string;
  audience: "TRAINER" | "CLIENT";
  niche: string;
  targetGroup: OutreachTargetGroup;
  whyMatchFit: string;
  likelihoodScore: number;
  pagePostText: string;
  notes?: string;
};

export type GeneratedEmailLead = {
  name: string;
  email: string;
  businessName: string;
  niche: string;
  emailSourceUrl: string;
  targetGroup: OutreachTargetGroup;
  whyMatchFit: string;
  likelihoodScore: number;
  emailSubject: string;
  emailBody: string;
  notes?: string;
};

export type GeneratedOtherLead = {
  contactLabel: string;
  contactUrl: string;
  channelNotes: string;
  niche: string;
  targetGroup: OutreachTargetGroup;
  whyMatchFit: string;
  likelihoodScore: number;
  outreachText: string;
  notes?: string;
};

async function callAi(system: string, user: string): Promise<string | null> {
  const status = getAdminAiProviderStatus();
  if (!status.configured) return null;

  if (status.provider === "anthropic") {
    const key = process.env.ANTHROPIC_API_KEY?.trim();
    if (!key) return null;
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: status.model ?? "claude-sonnet-4-20250514",
        max_tokens: 4000,
        system,
        messages: [{ role: "user", content: user }],
        temperature: 0.5,
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { content?: { type: string; text?: string }[] };
    return data.content?.find((b) => b.type === "text")?.text ?? null;
  }

  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: status.model ?? "gpt-4o-mini",
      max_tokens: 4000,
      temperature: 0.5,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content ?? null;
}

function parseJsonArray<T>(raw: string): T[] {
  const clean = raw.replace(/```json|```/g, "").trim();
  try {
    const parsed = JSON.parse(clean) as unknown;
    if (Array.isArray(parsed)) return parsed as T[];
  } catch {
    const m = clean.match(/\[[\s\S]*\]/);
    if (m) return JSON.parse(m[0]) as T[];
  }
  return [];
}

async function getExclusionList(platform: OutreachPlatform): Promise<string[]> {
  if (platform === "instagram") {
    const rows = await prisma.outreachInstagramLead.findMany({
      select: { handle: true, profileUrl: true },
    });
    return rows.flatMap((r) => [r.handle.toLowerCase(), r.profileUrl.toLowerCase()]);
  }
  if (platform === "facebook") {
    const rows = await prisma.outreachFacebookLead.findMany({ select: { pageUrl: true, pageName: true } });
    return rows.flatMap((r) => [r.pageUrl.toLowerCase(), r.pageName.toLowerCase()]);
  }
  if (platform === "email") {
    const rows = await prisma.outreachEmailLead.findMany({ select: { email: true } });
    return rows.map((r) => r.email.toLowerCase());
  }
  const rows = await prisma.outreachOtherLead.findMany({ select: { contactLabel: true, contactUrl: true } });
  return rows.flatMap((r) => [r.contactLabel.toLowerCase(), (r.contactUrl ?? "").toLowerCase()].filter(Boolean));
}

function normalizeGroup(g: string): OutreachTargetGroup {
  return g === "ATL_LOCAL" || g === "ATL Local" || g === "ATL" ? "ATL_LOCAL" : "VIRTUAL";
}

export type OutreachLeadVerificationSummary = {
  parsed: number;
  saved: number;
  rejected: number;
  rejectedSamples: { handle: string; reason: string }[];
};

export async function generateOutreachLeads(args: {
  platform: OutreachPlatform;
  atlCount: number;
  virtualCount: number;
  adminId: string;
}): Promise<{
  batchId: string;
  leads: unknown[];
  aiUsed: boolean;
  message?: string;
  verification?: OutreachLeadVerificationSummary;
}> {
  const batchId = `batch_${Date.now()}_${args.adminId.slice(0, 6)}`;
  const exclusions = await getExclusionList(args.platform);
  const learning = await buildOutreachLearningContext(args.platform);
  const tailAtl = genericInviteTail(args.platform, "ATL_LOCAL");
  const tailVirtual = genericInviteTail(args.platform, "VIRTUAL");

  const system = [
    "You are Match Fit's outreach research assistant.",
    OUTREACH_BRAND_FACTS,
    learning,
    "Return ONLY a valid JSON array. No markdown fences.",
    "Never suggest handles, emails, or URLs already in the exclusion list.",
    "For Instagram: NEVER invent or guess usernames. Only include accounts you are highly confident are real, public, and currently active.",
    "Each lead needs a short whyMatchFit (1 sentence) and likelihoodScore (0-100).",
  ].join("\n");

  const userPrompt = buildPlatformPrompt(args.platform, args.atlCount, args.virtualCount, exclusions, tailAtl, tailVirtual);
  const raw = await callAi(system, userPrompt);

  if (!raw) {
    return {
      batchId,
      leads: [],
      aiUsed: false,
      message: "AI provider not configured. Add ANTHROPIC_API_KEY or OPENAI_API_KEY.",
    };
  }

  const saved = await persistGeneratedLeads(args.platform, raw, batchId, args.adminId, tailAtl, tailVirtual);
  const verification = saved.verification;
  const leads = saved.leads;
  let message: string | undefined;
  if (args.platform === "instagram" && verification && verification.saved === 0 && verification.parsed > 0) {
    message =
      "AI returned Instagram handles, but none resolved to live profiles. Try generating again or add leads manually.";
  } else if (args.platform === "instagram" && verification && verification.rejected > 0) {
    message = `Saved ${verification.saved} verified Instagram lead(s); skipped ${verification.rejected} invalid or unavailable profile(s).`;
  }
  return { batchId, leads, aiUsed: true, message, verification };
}

function buildPlatformPrompt(
  platform: OutreachPlatform,
  atlCount: number,
  virtualCount: number,
  exclusions: string[],
  tailAtl: string,
  tailVirtual: string,
): string {
  const excl = exclusions.slice(0, 200).join(", ") || "none yet";
  if (platform === "instagram") {
    return `Find ${atlCount} ATL-local and ${virtualCount} virtual fitness trainer Instagram profiles for Match Fit outreach.
Exclude: ${excl}

CRITICAL RULES:
- Only include Instagram usernames that are real, public, and currently active. Do NOT invent handles.
- profileUrl must be https://www.instagram.com/username/ (lowercase username, no extra paths).
- Prefer established coaches/creators you are confident exist; skip any account you are unsure about.

JSON schema per item:
{"handle":"@username","profileUrl":"https://www.instagram.com/username/","niche":"strength coaching","targetGroup":"ATL_LOCAL"|"VIRTUAL","whyMatchFit":"one sentence","likelihoodScore":72,"personalHook":"specific content detail for opener","commentText":"short comment for their post","commentPostRef":"which post to comment on","notes":"optional"}

Use targetGroup ATL_LOCAL for Atlanta-based, VIRTUAL for online-only.
Generic invite tail for ATL: "${tailAtl}"
Generic invite tail for Virtual: "${tailVirtual}"`;
  }
  if (platform === "facebook") {
    return `Find ${atlCount + virtualCount} active Facebook groups or pages for Atlanta fitness trainer outreach.
Exclude: ${excl}

JSON schema:
{"pageName":"name","pageUrl":"https://facebook.com/groups/...","audience":"TRAINER"|"CLIENT","niche":"personal training","targetGroup":"ATL_LOCAL","whyMatchFit":"one sentence","likelihoodScore":65,"pagePostText":"full post with personalized opener + generic tail","notes":"optional"}

Generic tail: "${tailAtl}"`;
  }
  if (platform === "email") {
    return `Find ${atlCount} ATL-local and ${virtualCount} virtual fitness professionals with public contact emails.
Exclude: ${excl}

JSON schema:
{"name":"First Last","email":"trainer@domain.com","businessName":"Gym or brand","niche":"strength","emailSourceUrl":"where email was found","targetGroup":"ATL_LOCAL"|"VIRTUAL","whyMatchFit":"one sentence","likelihoodScore":60,"personalHook":"specific detail","notes":"optional"}

Generic tail ATL: "${tailAtl}"
Generic tail Virtual: "${tailVirtual}"`;
  }
  return `Find ${atlCount + virtualCount} other-channel fitness pro leads (LinkedIn, X, referrals).
Exclude: ${excl}

JSON schema:
{"contactLabel":"Name or handle","contactUrl":"https://...","channelNotes":"LinkedIn etc","niche":"coaching","targetGroup":"ATL_LOCAL"|"VIRTUAL","whyMatchFit":"one sentence","likelihoodScore":55,"personalHook":"detail","notes":"optional"}

Generic tail: "${tailAtl}"`;
}

async function persistGeneratedLeads(
  platform: OutreachPlatform,
  raw: string,
  batchId: string,
  adminId: string,
  tailAtl: string,
  tailVirtual: string,
): Promise<{ leads: unknown[]; verification?: OutreachLeadVerificationSummary }> {
  if (platform === "instagram") {
    const items = parseJsonArray<GeneratedInstagramLead & { personalHook?: string }>(raw);
    const created = [];
    const rejectedSamples: { handle: string; reason: string }[] = [];
    const seenUsernames = new Set<string>();

    for (const item of items) {
      const normalized = normalizeInstagramLeadIdentity({
        handle: item.handle,
        profileUrl: item.profileUrl,
      });
      if (!normalized) {
        rejectedSamples.push({
          handle: item.handle ?? item.profileUrl ?? "unknown",
          reason: "Invalid Instagram handle or profile URL.",
        });
        continue;
      }
      if (seenUsernames.has(normalized.username)) continue;
      seenUsernames.add(normalized.username);

      const verified = await verifyInstagramProfile(normalized.username);
      await sleepMs(250);
      if (!verified.ok) {
        rejectedSamples.push({ handle: normalized.handle, reason: verified.reason });
        continue;
      }

      const group = normalizeGroup(item.targetGroup ?? "VIRTUAL");
      const tail = group === "ATL_LOCAL" ? tailAtl : tailVirtual;
      const hook =
        item.personalHook ??
        verified.biography?.slice(0, 120) ??
        item.whyMatchFit ??
        "your recent training content";
      const opener = instagramPersonalizedOpener(group, verified.username, hook);
      const dmText = `${opener}${tail}`;
      const row = await prisma.outreachInstagramLead.create({
        data: {
          handle: `@${verified.username}`,
          profileUrl: verified.profileUrl,
          niche: item.niche ?? "Fitness coaching",
          targetGroup: group,
          whyMatchFit: item.whyMatchFit ?? "Strong fit for Match Fit beta roster.",
          likelihoodScore: clampScore(item.likelihoodScore),
          notes: [item.notes, verified.fullName ? `Verified as ${verified.fullName}` : null].filter(Boolean).join(" · ") || null,
          dmText,
          commentText: item.commentText ?? `Love the work you're putting in 🔥`,
          commentPostRef: item.commentPostRef ?? "Latest post",
          genericInviteTail: tail,
          generationBatchId: batchId,
          createdByAdminId: adminId,
        },
      });
      created.push(row);
    }
    await prisma.outreachDailyTemplate.createMany({
      data: [
        { platform: "instagram", targetGroup: "ATL_LOCAL", genericInviteTail: tailAtl, generationBatchId: `${batchId}_atl` },
        { platform: "instagram", targetGroup: "VIRTUAL", genericInviteTail: tailVirtual, generationBatchId: `${batchId}_virt` },
      ],
      skipDuplicates: true,
    });
    return {
      leads: created,
      verification: {
        parsed: items.length,
        saved: created.length,
        rejected: Math.max(0, items.length - created.length),
        rejectedSamples: rejectedSamples.slice(0, 8),
      },
    };
  }

  if (platform === "facebook") {
    const items = parseJsonArray<GeneratedFacebookLead>(raw);
    const created = [];
    for (const item of items) {
      const group = normalizeGroup(item.targetGroup ?? "ATL_LOCAL");
      const row = await prisma.outreachFacebookLead.create({
        data: {
          pageName: item.pageName ?? "Facebook group",
          pageUrl: item.pageUrl ?? "",
          audience: item.audience === "CLIENT" ? "CLIENT" : "TRAINER",
          niche: item.niche ?? null,
          targetGroup: group,
          whyMatchFit: item.whyMatchFit ?? "Active audience for Match Fit.",
          likelihoodScore: clampScore(item.likelihoodScore),
          notes: item.notes ?? null,
          pagePostText: item.pagePostText ?? `👋 Atlanta trainers — ${tailAtl}`,
          genericInviteTail: tailAtl,
          generationBatchId: batchId,
          createdByAdminId: adminId,
        },
      });
      created.push(row);
    }
    return { leads: created };
  }

  if (platform === "email") {
    const items = parseJsonArray<GeneratedEmailLead & { personalHook?: string }>(raw);
    const created = [];
    for (const item of items) {
      const group = normalizeGroup(item.targetGroup ?? "ATL_LOCAL");
      const tail = group === "ATL_LOCAL" ? tailAtl : tailVirtual;
      const first = (item.name ?? "there").split(" ")[0];
      const hook = (item as { personalHook?: string }).personalHook ?? item.whyMatchFit;
      const body = `Hey ${first},\n\nI'm Jonny, founder of Match Fit. ${hook}\n\n${tail}`;
      const row = await prisma.outreachEmailLead.create({
        data: {
          name: item.name ?? "Trainer",
          email: item.email ?? "",
          businessName: item.businessName ?? null,
          niche: item.niche ?? null,
          emailSourceUrl: item.emailSourceUrl ?? null,
          targetGroup: group,
          whyMatchFit: item.whyMatchFit ?? "Good fit for founding trainer roster.",
          likelihoodScore: clampScore(item.likelihoodScore),
          notes: item.notes ?? null,
          emailSubject: item.emailSubject ?? emailSubject(group),
          emailBody: item.emailBody ?? body,
          genericInviteTail: tail,
          generationBatchId: batchId,
          createdByAdminId: adminId,
        },
      });
      created.push(row);
    }
    return { leads: created };
  }

  const items = parseJsonArray<GeneratedOtherLead & { personalHook?: string }>(raw);
  const created = [];
  for (const item of items) {
    const group = normalizeGroup(item.targetGroup ?? "ATL_LOCAL");
    const tail = group === "ATL_LOCAL" ? tailAtl : tailVirtual;
    const row = await prisma.outreachOtherLead.create({
      data: {
        contactLabel: item.contactLabel ?? "Contact",
        contactUrl: item.contactUrl ?? null,
        channelNotes: item.channelNotes ?? null,
        niche: item.niche ?? null,
        targetGroup: group,
        whyMatchFit: item.whyMatchFit ?? "Potential Match Fit trainer.",
        likelihoodScore: clampScore(item.likelihoodScore),
        notes: item.notes ?? null,
        outreachText: item.outreachText ?? tail,
        genericInviteTail: tail,
        generationBatchId: batchId,
        createdByAdminId: adminId,
      },
    });
    created.push(row);
  }
  return { leads: created };
}

function clampScore(n: number | undefined): number {
  if (typeof n !== "number" || Number.isNaN(n)) return 50;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export async function buildCoworkMorningBrief(): Promise<{
  generatedAt: string;
  instructions: string;
  instagram: unknown[];
  facebook: unknown[];
  email: unknown[];
  other: unknown[];
}> {
  const [ig, fb, em, other] = await Promise.all([
    prisma.outreachInstagramLead.findMany({
      where: { deletedAt: null, status: "LEAD" },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.outreachFacebookLead.findMany({
      where: { deletedAt: null, status: "LEAD" },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.outreachEmailLead.findMany({
      where: { deletedAt: null, status: "LEAD" },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.outreachOtherLead.findMany({
      where: { deletedAt: null, status: "LEAD" },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    instructions: [
      "Claude Cowork morning workflow:",
      "1. Open /admin/outreach and review today's Lead-status bubbles.",
      "2. Instagram: open profile URL in a tab, send DM (dmText), post comment (commentText) on commentPostRef.",
      "3. Facebook: post pagePostText on pageUrl.",
      "4. Email: send emailBody with emailSubject.",
      "5. PATCH each lead status via /api/admin/outreach/leads/[id] when complete.",
      "6. Edit copy in the UI before sending if needed — edits train the next generation.",
    ].join("\n"),
    instagram: ig,
    facebook: fb,
    email: em,
    other: other,
  };
}
