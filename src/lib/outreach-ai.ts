import "server-only";

import { getAdminAiProviderStatusAsync } from "@/lib/admin-analytics-ai";
import {
  countAvailableInstagramSeeds,
  pickInstagramSeedLeads,
  type OutreachInstagramSeed,
} from "@/lib/outreach-instagram-seeds";
import { normalizeInstagramLeadIdentity } from "@/lib/instagram-profile-verify";
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

type AiCallResult = { ok: true; text: string } | { ok: false; error: string };

async function callAi(system: string, user: string): Promise<AiCallResult> {
  const status = await getAdminAiProviderStatusAsync();
  if (!status.configured) {
    return { ok: false, error: "AI provider not configured. Add ANTHROPIC_API_KEY or OPENAI_API_KEY." };
  }

  if (status.provider === "anthropic") {
    const key = process.env.ANTHROPIC_API_KEY?.trim();
    if (!key) {
      return { ok: false, error: "ANTHROPIC_API_KEY is missing on the server." };
    }
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: status.model ?? "claude-sonnet-4-6",
        max_tokens: 4000,
        system,
        messages: [{ role: "user", content: user }],
        temperature: 0.5,
      }),
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => "")).slice(0, 240);
      console.error("[outreach-ai] Anthropic API error:", res.status, detail);
      return {
        ok: false,
        error: `Anthropic API rejected the request (HTTP ${res.status}). Check the API key and model (${status.model}).`,
      };
    }
    const data = (await res.json()) as { content?: { type: string; text?: string }[] };
    const text = data.content?.find((b) => b.type === "text")?.text ?? null;
    if (!text?.trim()) {
      return { ok: false, error: "Anthropic returned an empty response." };
    }
    return { ok: true, text };
  }

  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    return { ok: false, error: "OPENAI_API_KEY is missing on the server." };
  }
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
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 240);
    console.error("[outreach-ai] OpenAI API error:", res.status, detail);
    return {
      ok: false,
      error: `OpenAI API rejected the request (HTTP ${res.status}). Check the API key and model (${status.model}).`,
    };
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = data.choices?.[0]?.message?.content ?? null;
  if (!text?.trim()) {
    return { ok: false, error: "OpenAI returned an empty response." };
  }
  return { ok: true, text };
}

function parseJsonArray<T>(raw: string): T[] {
  const clean = raw.replace(/```json|```/g, "").trim();
  const tryParse = (text: string): T[] | null => {
    try {
      const parsed = JSON.parse(text) as unknown;
      if (Array.isArray(parsed)) return parsed as T[];
      if (parsed && typeof parsed === "object") {
        const record = parsed as Record<string, unknown>;
        for (const key of ["leads", "items", "data", "results"]) {
          if (Array.isArray(record[key])) return record[key] as T[];
        }
      }
    } catch {
      return null;
    }
    return null;
  };

  const direct = tryParse(clean);
  if (direct) return direct;

  const match = clean.match(/\[[\s\S]*\]/);
  if (match) {
    const nested = tryParse(match[0]);
    if (nested) return nested;
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

  const instagramSeeds =
    args.platform === "instagram"
      ? pickInstagramSeedLeads({
          atlCount: args.atlCount,
          virtualCount: args.virtualCount,
          exclusions,
        })
      : [];

  if (args.platform === "instagram" && instagramSeeds.length === 0) {
    const available = countAvailableInstagramSeeds(exclusions);
    return {
      batchId,
      leads: [],
      aiUsed: false,
      message: `No new Instagram leads available — all seed accounts are already in your database (${available.atl} ATL and ${available.virtual} virtual remaining). Delete an old pull or lower your counts.`,
    };
  }

  const system = [
    "You are Match Fit's outreach research assistant.",
    OUTREACH_BRAND_FACTS,
    learning,
    "Return ONLY a valid JSON array. No markdown fences.",
    "Never suggest handles, emails, or URLs already in the exclusion list.",
    args.platform === "instagram"
      ? "For Instagram: keep every handle and profileUrl exactly as provided in the user prompt."
      : "For Instagram: NEVER invent or guess usernames. Only include accounts you are highly confident are real, public, and currently active.",
    "Each lead needs a short whyMatchFit (1 sentence) and likelihoodScore (0-100).",
  ].join("\n");

  const userPrompt =
    args.platform === "instagram"
      ? buildInstagramCopyPrompt(instagramSeeds, tailAtl, tailVirtual)
      : buildPlatformPrompt(args.platform, args.atlCount, args.virtualCount, exclusions, tailAtl, tailVirtual);

  const ai = await callAi(system, userPrompt);

  if (!ai.ok) {
    if (args.platform === "instagram" && instagramSeeds.length > 0) {
      const saved = await persistGeneratedLeads(
        args.platform,
        "[]",
        batchId,
        args.adminId,
        tailAtl,
        tailVirtual,
        instagramSeeds,
      );
      if (saved.leads.length > 0) {
        return {
          batchId,
          leads: saved.leads,
          aiUsed: false,
          message: `${ai.error} Saved ${saved.leads.length} lead(s) with default outreach copy instead.`,
          verification: saved.verification,
        };
      }
    }
    return {
      batchId,
      leads: [],
      aiUsed: false,
      message: ai.error,
    };
  }

  const saved = await persistGeneratedLeads(
    args.platform,
    ai.text,
    batchId,
    args.adminId,
    tailAtl,
    tailVirtual,
    args.platform === "instagram" ? instagramSeeds : undefined,
  );
  const verification = saved.verification;
  const leads = saved.leads;
  let message: string | undefined;

  if (leads.length === 0) {
    if (args.platform === "instagram" && verification) {
      if (verification.parsed === 0) {
        message =
          "AI did not return parseable Instagram leads. Try generating again — the model may have returned prose instead of JSON.";
      } else {
        const sampleReasons = verification.rejectedSamples
          .slice(0, 3)
          .map((s) => `${s.handle}: ${s.reason}`)
          .join("; ");
        message = sampleReasons
          ? `AI returned ${verification.parsed} handle(s), but none could be verified. Examples: ${sampleReasons}`
          : "AI returned Instagram handles, but none resolved to live profiles. Try generating again.";
      }
    } else if (verification?.parsed === 0 || !verification) {
      message =
        "AI did not return any usable leads. Try generating again — if this keeps happening, check the server API key and model.";
    } else {
      message = "No leads were saved from this generation run. Try again.";
    }
  } else if (args.platform === "instagram" && verification && verification.rejected > 0) {
    message = `Saved ${verification.saved} verified Instagram lead(s); skipped ${verification.rejected} invalid or unavailable profile(s).`;
  }

  return { batchId, leads, aiUsed: true, message, verification };
}

function buildInstagramCopyPrompt(seeds: OutreachInstagramSeed[], tailAtl: string, tailVirtual: string): string {
  return `Write personalized Instagram outreach for EXACTLY these ${seeds.length} confirmed profiles.
You MUST keep handle and profileUrl unchanged for each row. Do not add or remove profiles.

Profiles:
${JSON.stringify(
  seeds.map((s) => ({
    handle: s.handle,
    profileUrl: s.profileUrl,
    niche: s.niche,
    targetGroup: s.targetGroup,
    displayName: s.displayName,
  })),
  null,
  2,
)}

Return ONLY a JSON array with one object per profile above, same order, using this schema:
{"handle":"@username","profileUrl":"https://www.instagram.com/username/","niche":"...","targetGroup":"ATL_LOCAL"|"VIRTUAL","whyMatchFit":"one sentence","likelihoodScore":72,"personalHook":"specific detail for opener","commentText":"short comment for their post","commentPostRef":"Latest post","notes":"optional"}

Generic invite tail for ATL: "${tailAtl}"
Generic invite tail for Virtual: "${tailVirtual}"`;
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
  instagramSeeds?: OutreachInstagramSeed[],
): Promise<{ leads: unknown[]; verification?: OutreachLeadVerificationSummary }> {
  if (platform === "instagram") {
    const seeds = instagramSeeds ?? [];
    const seedByUsername = new Map(seeds.map((s) => [s.username.toLowerCase(), s]));
    const aiItems = parseJsonArray<GeneratedInstagramLead & { personalHook?: string }>(raw);
    const aiByUsername = new Map<string, GeneratedInstagramLead & { personalHook?: string }>();

    for (const item of aiItems) {
      const normalized = normalizeInstagramLeadIdentity({
        handle: item.handle,
        profileUrl: item.profileUrl,
      });
      if (normalized) aiByUsername.set(normalized.username, item);
    }

    const created = [];
    const rejectedSamples: { handle: string; reason: string }[] = [];

    for (const seed of seeds) {
      const item = aiByUsername.get(seed.username.toLowerCase());
      const group = normalizeGroup(item?.targetGroup ?? seed.targetGroup);
      const tail = group === "ATL_LOCAL" ? tailAtl : tailVirtual;
      const hook = item?.personalHook ?? item?.whyMatchFit ?? seed.niche ?? "your recent training content";
      const opener = instagramPersonalizedOpener(group, seed.username, hook);
      const dmText = item?.dmText?.trim() ? item.dmText : `${opener}${tail}`;

      try {
        const row = await prisma.outreachInstagramLead.create({
          data: {
            handle: seed.handle,
            profileUrl: seed.profileUrl,
            niche: item?.niche ?? seed.niche,
            targetGroup: group,
            whyMatchFit: item?.whyMatchFit ?? `Strong fit for Match Fit — ${seed.displayName} audience aligns with our trainer roster.`,
            likelihoodScore: clampScore(item?.likelihoodScore),
            notes: [item?.notes, "Pre-verified seed account."].filter(Boolean).join(" · ") || null,
            dmText,
            commentText: item?.commentText ?? `Love the work you're putting in 🔥`,
            commentPostRef: item?.commentPostRef ?? "Latest post",
            genericInviteTail: tail,
            generationBatchId: batchId,
            createdByAdminId: adminId,
          },
        });
        created.push(row);
      } catch (e) {
        console.error("[outreach-ai] Failed to save Instagram seed lead:", seed.username, e);
        rejectedSamples.push({
          handle: seed.handle,
          reason: "Could not save lead to database.",
        });
      }
    }

    if (seeds.length === 0) {
      rejectedSamples.push({ handle: "batch", reason: "No seed profiles selected." });
    } else if (created.length === 0 && aiItems.length === 0) {
      rejectedSamples.push({
        handle: seeds[0]?.handle ?? "batch",
        reason: "AI did not return parseable outreach copy.",
      });
    }

    try {
      await prisma.outreachDailyTemplate.createMany({
        data: [
          {
            platform: "instagram",
            targetGroup: "ATL_LOCAL",
            genericInviteTail: tailAtl,
            generationBatchId: `${batchId}_atl`,
          },
          {
            platform: "instagram",
            targetGroup: "VIRTUAL",
            genericInviteTail: tailVirtual,
            generationBatchId: `${batchId}_virt`,
          },
        ],
        skipDuplicates: true,
      });
    } catch (e) {
      console.warn("[outreach-ai] outreachDailyTemplate createMany skipped:", e);
    }

    return {
      leads: created,
      verification: {
        parsed: seeds.length,
        saved: created.length,
        rejected: Math.max(0, seeds.length - created.length),
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
