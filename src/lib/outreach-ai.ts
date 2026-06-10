import "server-only";

import { getAdminAiProviderStatus } from "@/lib/admin-analytics-ai";
import { hydratePlatformEnvFromDatabase } from "@/lib/hydrate-platform-env";
import {
  getOutreachExclusionList,
  isExcludedValue,
  normalizeEmail,
  normalizeInstagramHandle,
  normalizeInstagramProfileUrl,
} from "@/lib/outreach-exclusions";
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
  sourceUrl?: string;
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
  sourceUrl?: string;
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
  sourceUrl?: string;
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
  sourceUrl?: string;
};

type OutreachAiResult = {
  text: string | null;
  usedWebSearch: boolean;
  provider: string;
};

function extractAnthropicText(data: { content?: { type: string; text?: string }[] }): string | null {
  const blocks = data.content?.filter((block) => block.type === "text" && block.text?.trim()) ?? [];
  if (blocks.length === 0) return null;
  return blocks.map((block) => block.text!.trim()).join("\n\n");
}

async function callOutreachAi(system: string, user: string): Promise<OutreachAiResult> {
  await hydratePlatformEnvFromDatabase();
  const status = getAdminAiProviderStatus();
  if (!status.configured) {
    return { text: null, usedWebSearch: false, provider: "none" };
  }

  if (status.provider === "anthropic") {
    const key = process.env.ANTHROPIC_API_KEY?.trim();
    if (!key) return { text: null, usedWebSearch: false, provider: "anthropic" };

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: status.model ?? "claude-sonnet-4-6",
        max_tokens: 8000,
        system,
        messages: [{ role: "user", content: user }],
        temperature: 0.2,
        tools: [
          {
            type: "web_search_20250305",
            name: "web_search",
            max_uses: 12,
            user_location: {
              type: "approximate",
              city: "Atlanta",
              region: "Georgia",
              country: "US",
              timezone: "America/New_York",
            },
          },
        ],
      }),
    });

    if (!res.ok) {
      console.error("[outreach-ai] Anthropic web search request failed:", res.status, await res.text().catch(() => ""));
      return { text: null, usedWebSearch: true, provider: "anthropic" };
    }

    const data = (await res.json()) as { content?: { type: string; text?: string }[] };
    return {
      text: extractAnthropicText(data),
      usedWebSearch: true,
      provider: "anthropic",
    };
  }

  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return { text: null, usedWebSearch: false, provider: "openai" };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: status.model ?? "gpt-4o-mini",
      max_tokens: 4000,
      temperature: 0.2,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) {
    console.error("[outreach-ai] OpenAI request failed:", res.status, await res.text().catch(() => ""));
    return { text: null, usedWebSearch: false, provider: "openai" };
  }

  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return {
    text: data.choices?.[0]?.message?.content ?? null,
    usedWebSearch: false,
    provider: "openai",
  };
}

function parseJsonArray<T>(raw: string): T[] {
  const clean = raw.replace(/```json|```/g, "").trim();
  try {
    const parsed = JSON.parse(clean) as unknown;
    if (Array.isArray(parsed)) return parsed as T[];
  } catch {
    const match = clean.match(/\[[\s\S]*\]/);
    if (match) return JSON.parse(match[0]) as T[];
  }
  return [];
}

function normalizeGroup(g: string): OutreachTargetGroup {
  return g === "ATL_LOCAL" || g === "ATL Local" || g === "ATL" ? "ATL_LOCAL" : "VIRTUAL";
}

export async function generateOutreachLeads(args: {
  platform: OutreachPlatform;
  atlCount: number;
  virtualCount: number;
  adminId: string;
}): Promise<{
  batchId: string;
  leads: unknown[];
  aiUsed: boolean;
  usedWebSearch: boolean;
  skippedCount: number;
  message?: string;
}> {
  await hydratePlatformEnvFromDatabase();
  const batchId = `batch_${Date.now()}_${args.adminId.slice(0, 6)}`;
  const exclusions = await getOutreachExclusionList(args.platform);
  const learning = await buildOutreachLearningContext(args.platform);
  const tailAtl = genericInviteTail(args.platform, "ATL_LOCAL");
  const tailVirtual = genericInviteTail(args.platform, "VIRTUAL");

  const system = [
    "You are Match Fit's outreach research assistant.",
    OUTREACH_BRAND_FACTS,
    learning,
    "CRITICAL: Use web search before answering. Only return fitness professionals you can verify from live public web results.",
    "Never invent Instagram handles, Facebook pages, or email addresses.",
    "Skip anyone already registered on Match Fit or already in the exclusion list.",
    "Return ONLY a valid JSON array. No markdown fences.",
    "Each lead needs whyMatchFit (1 sentence), likelihoodScore (0-100), and sourceUrl (the page you verified).",
  ].join("\n");

  const userPrompt = buildPlatformPrompt(
    args.platform,
    args.atlCount,
    args.virtualCount,
    exclusions,
    tailAtl,
    tailVirtual,
  );
  const ai = await callOutreachAi(system, userPrompt);

  if (!ai.text) {
    const providerHint =
      ai.provider === "openai"
        ? " OpenAI fallback cannot web-search — set ANTHROPIC_API_KEY for real profile discovery."
        : "";
    return {
      batchId,
      leads: [],
      aiUsed: false,
      usedWebSearch: ai.usedWebSearch,
      skippedCount: 0,
      message: `AI provider not configured or request failed.${providerHint}`,
    };
  }

  const { saved, skippedCount } = await persistGeneratedLeads(
    args.platform,
    ai.text,
    batchId,
    args.adminId,
    tailAtl,
    tailVirtual,
    exclusions,
  );

  let message: string | undefined;
  if (saved.length === 0) {
    message = ai.usedWebSearch
      ? "Web search ran but no verifiable new leads passed validation. Try smaller counts or delete stale/fake rows and regenerate."
      : "Generation completed without web search. Configure ANTHROPIC_API_KEY for verified real-profile discovery.";
  } else if (!ai.usedWebSearch) {
    message = "Warning: OpenAI fallback used memory-only discovery. Prefer Anthropic for real verified profiles.";
  } else if (skippedCount > 0) {
    message = `Saved ${saved.length} verified lead(s); skipped ${skippedCount} duplicate or unverifiable result(s).`;
  }

  return {
    batchId,
    leads: saved,
    aiUsed: true,
    usedWebSearch: ai.usedWebSearch,
    skippedCount,
    message,
  };
}

function buildPlatformPrompt(
  platform: OutreachPlatform,
  atlCount: number,
  virtualCount: number,
  exclusions: string[],
  tailAtl: string,
  tailVirtual: string,
): string {
  const excl = exclusions.slice(0, 250).join(", ") || "none yet";
  if (platform === "instagram") {
    return `Use web search to find ${atlCount} ATL-local and ${virtualCount} virtual fitness trainer Instagram profiles for Match Fit outreach.

Search ideas:
- "Atlanta personal trainer instagram"
- "Atlanta strength coach instagram site:instagram.com"
- "online fitness coach instagram virtual training"

Exclude handles/URLs already contacted or already on Match Fit: ${excl}

Return ONLY profiles you verified via web search. Do not guess usernames.

JSON schema per item:
{"handle":"@username","profileUrl":"https://instagram.com/username","niche":"strength coaching","targetGroup":"ATL_LOCAL"|"VIRTUAL","whyMatchFit":"one sentence","likelihoodScore":72,"personalHook":"specific content detail from their profile","commentText":"short comment for their post","commentPostRef":"which post to comment on","sourceUrl":"https://...","notes":"optional"}

Use targetGroup ATL_LOCAL for Atlanta-based, VIRTUAL for online-only.
Generic invite tail for ATL: "${tailAtl}"
Generic invite tail for Virtual: "${tailVirtual}"`;
  }
  if (platform === "facebook") {
    return `Use web search to find ${atlCount} ATL-local and ${virtualCount} virtual Facebook groups/pages for Atlanta fitness trainer outreach.

Exclude: ${excl}

JSON schema:
{"pageName":"name","pageUrl":"https://facebook.com/groups/...","audience":"TRAINER"|"CLIENT","niche":"personal training","targetGroup":"ATL_LOCAL"|"VIRTUAL","whyMatchFit":"one sentence","likelihoodScore":65,"pagePostText":"full post with personalized opener + generic tail","sourceUrl":"https://...","notes":"optional"}

Generic tail: "${tailAtl}"`;
  }
  if (platform === "email") {
    return `Use web search to find ${atlCount} ATL-local and ${virtualCount} virtual fitness professionals with public contact emails.

Exclude: ${excl}

JSON schema:
{"name":"First Last","email":"trainer@domain.com","businessName":"Gym or brand","niche":"strength","emailSourceUrl":"where email was found","targetGroup":"ATL_LOCAL"|"VIRTUAL","whyMatchFit":"one sentence","likelihoodScore":60,"personalHook":"specific detail","sourceUrl":"https://...","notes":"optional"}

Generic tail ATL: "${tailAtl}"
Generic tail Virtual: "${tailVirtual}"`;
  }
  return `Use web search to find ${atlCount + virtualCount} other-channel fitness pro leads (LinkedIn, X, referrals).

Exclude: ${excl}

JSON schema:
{"contactLabel":"Name or handle","contactUrl":"https://...","channelNotes":"LinkedIn etc","niche":"coaching","targetGroup":"ATL_LOCAL"|"VIRTUAL","whyMatchFit":"one sentence","likelihoodScore":55,"personalHook":"detail","sourceUrl":"https://...","notes":"optional"}

Generic tail: "${tailAtl}"`;
}

async function persistGeneratedLeads(
  platform: OutreachPlatform,
  raw: string,
  batchId: string,
  adminId: string,
  tailAtl: string,
  tailVirtual: string,
  exclusions: string[],
): Promise<{ saved: unknown[]; skippedCount: number }> {
  let skippedCount = 0;
  const seen = new Set(exclusions.map((value) => value.trim().toLowerCase()));

  if (platform === "instagram") {
    const items = parseJsonArray<GeneratedInstagramLead & { personalHook?: string }>(raw);
    const created = [];
    for (const item of items) {
      const handle = normalizeInstagramHandle(item.handle ?? item.profileUrl);
      if (!handle) {
        skippedCount += 1;
        continue;
      }
      const profileUrl = normalizeInstagramProfileUrl(handle, item.profileUrl);
      const dedupeKeys = [handle, profileUrl.toLowerCase(), handle.replace(/^@/, "")];
      if (dedupeKeys.some((key) => seen.has(key.toLowerCase()))) {
        skippedCount += 1;
        continue;
      }

      const group = normalizeGroup(item.targetGroup ?? "VIRTUAL");
      const tail = group === "ATL_LOCAL" ? tailAtl : tailVirtual;
      const name = handle.replace("@", "");
      const hook = item.personalHook ?? item.whyMatchFit ?? "your recent training content";
      const opener = instagramPersonalizedOpener(group, name, hook);
      const dmText = `${opener}${tail}`;
      const sourceNote = item.sourceUrl?.trim() ? `Source: ${item.sourceUrl.trim()}` : null;
      const row = await prisma.outreachInstagramLead.create({
        data: {
          handle,
          profileUrl,
          niche: item.niche ?? "Fitness coaching",
          targetGroup: group,
          whyMatchFit: item.whyMatchFit ?? "Strong fit for Match Fit beta roster.",
          likelihoodScore: clampScore(item.likelihoodScore),
          notes: [item.notes?.trim(), sourceNote].filter(Boolean).join("\n") || null,
          dmText,
          commentText: item.commentText ?? `Love the work you're putting in 🔥`,
          commentPostRef: item.commentPostRef ?? "Latest post",
          genericInviteTail: tail,
          generationBatchId: batchId,
          createdByAdminId: adminId,
        },
      });
      for (const key of dedupeKeys) seen.add(key.toLowerCase());
      created.push(row);
    }
    if (created.length > 0) {
      await prisma.outreachDailyTemplate.createMany({
        data: [
          { platform: "instagram", targetGroup: "ATL_LOCAL", genericInviteTail: tailAtl, generationBatchId: `${batchId}_atl` },
          { platform: "instagram", targetGroup: "VIRTUAL", genericInviteTail: tailVirtual, generationBatchId: `${batchId}_virt` },
        ],
        skipDuplicates: true,
      });
    }
    return { saved: created, skippedCount };
  }

  if (platform === "facebook") {
    const items = parseJsonArray<GeneratedFacebookLead>(raw);
    const created = [];
    for (const item of items) {
      const pageUrl = (item.pageUrl ?? "").trim();
      const pageName = (item.pageName ?? "").trim();
      if (!pageUrl || !pageUrl.includes("facebook.com")) {
        skippedCount += 1;
        continue;
      }
      if (
        isExcludedValue(pageUrl, exclusions) ||
        (pageName && isExcludedValue(pageName, exclusions)) ||
        seen.has(pageUrl.toLowerCase())
      ) {
        skippedCount += 1;
        continue;
      }

      const group = normalizeGroup(item.targetGroup ?? "ATL_LOCAL");
      const row = await prisma.outreachFacebookLead.create({
        data: {
          pageName: pageName || "Facebook group",
          pageUrl,
          audience: item.audience === "CLIENT" ? "CLIENT" : "TRAINER",
          niche: item.niche ?? null,
          targetGroup: group,
          whyMatchFit: item.whyMatchFit ?? "Active audience for Match Fit.",
          likelihoodScore: clampScore(item.likelihoodScore),
          notes: item.sourceUrl?.trim() ? `Source: ${item.sourceUrl.trim()}` : item.notes ?? null,
          pagePostText: item.pagePostText ?? `👋 Atlanta trainers — ${tailAtl}`,
          genericInviteTail: tailAtl,
          generationBatchId: batchId,
          createdByAdminId: adminId,
        },
      });
      seen.add(pageUrl.toLowerCase());
      created.push(row);
    }
    return { saved: created, skippedCount };
  }

  if (platform === "email") {
    const items = parseJsonArray<GeneratedEmailLead & { personalHook?: string }>(raw);
    const created = [];
    for (const item of items) {
      const email = normalizeEmail(item.email);
      if (!email || isExcludedValue(email, exclusions) || seen.has(email)) {
        skippedCount += 1;
        continue;
      }

      const group = normalizeGroup(item.targetGroup ?? "ATL_LOCAL");
      const tail = group === "ATL_LOCAL" ? tailAtl : tailVirtual;
      const first = (item.name ?? "there").split(" ")[0];
      const hook = item.personalHook ?? item.whyMatchFit ?? "your coaching brand";
      const body = `Hey ${first},\n\nI'm Jonny, founder of Match Fit. ${hook}\n\n${tail}`;
      const row = await prisma.outreachEmailLead.create({
        data: {
          name: item.name ?? "Trainer",
          email,
          businessName: item.businessName ?? null,
          niche: item.niche ?? null,
          emailSourceUrl: item.emailSourceUrl ?? item.sourceUrl ?? null,
          targetGroup: group,
          whyMatchFit: item.whyMatchFit ?? "Good fit for founding trainer roster.",
          likelihoodScore: clampScore(item.likelihoodScore),
          notes: item.sourceUrl?.trim() ? `Source: ${item.sourceUrl.trim()}` : item.notes ?? null,
          emailSubject: item.emailSubject ?? emailSubject(group),
          emailBody: item.emailBody ?? body,
          genericInviteTail: tail,
          generationBatchId: batchId,
          createdByAdminId: adminId,
        },
      });
      seen.add(email);
      created.push(row);
    }
    return { saved: created, skippedCount };
  }

  const items = parseJsonArray<GeneratedOtherLead & { personalHook?: string }>(raw);
  const created = [];
  for (const item of items) {
    const contactUrl = (item.contactUrl ?? "").trim();
    const contactLabel = (item.contactLabel ?? "").trim();
    if (!contactUrl || !contactLabel) {
      skippedCount += 1;
      continue;
    }
    if (
      isExcludedValue(contactUrl, exclusions) ||
      isExcludedValue(contactLabel, exclusions) ||
      seen.has(contactUrl.toLowerCase())
    ) {
      skippedCount += 1;
      continue;
    }

    const group = normalizeGroup(item.targetGroup ?? "ATL_LOCAL");
    const tail = group === "ATL_LOCAL" ? tailAtl : tailVirtual;
    const row = await prisma.outreachOtherLead.create({
      data: {
        contactLabel,
        contactUrl,
        channelNotes: item.channelNotes ?? null,
        niche: item.niche ?? null,
        targetGroup: group,
        whyMatchFit: item.whyMatchFit ?? "Potential Match Fit trainer.",
        likelihoodScore: clampScore(item.likelihoodScore),
        notes: item.sourceUrl?.trim() ? `Source: ${item.sourceUrl.trim()}` : item.notes ?? null,
        outreachText: item.outreachText ?? tail,
        genericInviteTail: tail,
        generationBatchId: batchId,
        createdByAdminId: adminId,
      },
    });
    seen.add(contactUrl.toLowerCase());
    created.push(row);
  }
  return { saved: created, skippedCount };
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
      where: { deletedAt: null, status: { in: ["LEAD", "OUTREACH_SENT", "FOLLOW_UP_1", "FOLLOW_UP_2"] } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.outreachFacebookLead.findMany({
      where: { deletedAt: null, status: { in: ["LEAD", "OUTREACH_SENT"] } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.outreachEmailLead.findMany({
      where: { deletedAt: null, status: { in: ["LEAD", "OUTREACH_SENT", "FOLLOW_UP_1", "FOLLOW_UP_2"] } },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.outreachOtherLead.findMany({
      where: { deletedAt: null, status: { in: ["LEAD", "OUTREACH_SENT", "FOLLOW_UP_1", "FOLLOW_UP_2"] } },
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
