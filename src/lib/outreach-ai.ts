import "server-only";

import { getAdminAiProviderStatusAsync } from "@/lib/admin-analytics-ai";
import {
  assessFitnessProfessionalLeadText,
  assessFitnessProfessionalProfile,
  OUTREACH_EMAIL_CRITERIA,
  OUTREACH_FACEBOOK_CRITERIA,
  OUTREACH_INSTAGRAM_CRITERIA,
} from "@/lib/outreach-fitness-pro-verify";
import { assessEmailLeadContact, isLikelyPublicEmailSourceUrl } from "@/lib/outreach-email-verify";
import { verifyFacebookPageUrl } from "@/lib/outreach-facebook-verify";
import {
  mapWithConcurrency,
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
import type { AdminAiProviderId } from "@/lib/admin-analytics-ai";

const OUTREACH_AI_MAX_ATTEMPTS = 3;

function resolveOutreachAiModel(provider: AdminAiProviderId): string {
  if (provider === "anthropic") {
    return process.env.ANTHROPIC_OUTREACH_MODEL?.trim() || "claude-opus-4-6";
  }
  return process.env.OPENAI_OUTREACH_MODEL?.trim() || "gpt-4o";
}

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

  const outreachModel = resolveOutreachAiModel(status.provider);

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
        model: outreachModel,
        max_tokens: 6000,
        system,
        messages: [{ role: "user", content: user }],
        temperature: 0.4,
      }),
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => "")).slice(0, 240);
      console.error("[outreach-ai] Anthropic API error:", res.status, detail);
      return {
        ok: false,
        error: `Anthropic API rejected the request (HTTP ${res.status}). Check the API key and model (${outreachModel}).`,
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
      model: outreachModel,
      max_tokens: 6000,
      temperature: 0.4,
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
      error: `OpenAI API rejected the request (HTTP ${res.status}). Check the API key and model (${outreachModel}).`,
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
  const activeOnly = { deletedAt: null as null };

  if (platform === "instagram") {
    const rows = await prisma.outreachInstagramLead.findMany({
      where: activeOnly,
      select: { handle: true, profileUrl: true },
    });
    return rows.flatMap((r) => [r.handle.toLowerCase(), r.profileUrl.toLowerCase()]);
  }
  if (platform === "facebook") {
    const rows = await prisma.outreachFacebookLead.findMany({
      where: activeOnly,
      select: { pageUrl: true, pageName: true },
    });
    return rows.flatMap((r) => [r.pageUrl.toLowerCase(), r.pageName.toLowerCase()]);
  }
  if (platform === "email") {
    const rows = await prisma.outreachEmailLead.findMany({
      where: activeOnly,
      select: { email: true },
    });
    return rows.map((r) => r.email.toLowerCase());
  }
  const rows = await prisma.outreachOtherLead.findMany({
    where: activeOnly,
    select: { contactLabel: true, contactUrl: true },
  });
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
  attempts?: number;
};

function platformCriteria(platform: OutreachPlatform): string {
  if (platform === "instagram") return OUTREACH_INSTAGRAM_CRITERIA;
  if (platform === "facebook") return OUTREACH_FACEBOOK_CRITERIA;
  if (platform === "email") return OUTREACH_EMAIL_CRITERIA;
  return OUTREACH_INSTAGRAM_CRITERIA;
}

function buildOutreachSystemPrompt(platform: OutreachPlatform, learning: string): string {
  const criteria = platformCriteria(platform);
  return [
    "You are Match Fit's outreach research assistant.",
    OUTREACH_BRAND_FACTS,
    learning,
    criteria,
    "Return ONLY a valid JSON array. No markdown fences.",
    "Never suggest handles, emails, or URLs already in the exclusion list.",
    platform === "instagram"
      ? "Find real, public Instagram profiles of fitness professionals. NEVER invent usernames — only handles you are confident exist."
      : platform === "facebook"
        ? "Find real Facebook pages or groups where fitness trainers gather. NEVER invent URLs."
        : platform === "email"
          ? "Find real fitness professionals with publicly listed emails. NEVER invent email addresses."
          : "Find real fitness professional contacts. NEVER invent URLs or emails.",
    "Each lead needs a short whyMatchFit (1 sentence) and likelihoodScore (0-100).",
  ]
    .filter(Boolean)
    .join("\n");
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
  message?: string;
  verification?: OutreachLeadVerificationSummary;
}> {
  const batchId = `batch_${Date.now()}_${args.adminId.slice(0, 6)}`;
  let exclusions = await getExclusionList(args.platform);
  const learning = await buildOutreachLearningContext(args.platform);
  const tailAtl = genericInviteTail(args.platform, "ATL_LOCAL");
  const tailVirtual = genericInviteTail(args.platform, "VIRTUAL");
  const targetCount = args.atlCount + args.virtualCount;
  const system = buildOutreachSystemPrompt(args.platform, learning);

  let savedLeads: unknown[] = [];
  let lastVerification: OutreachLeadVerificationSummary | undefined;
  let lastAiError: string | undefined;
  let attempts = 0;
  let rejectionFeedback = "";

  while (attempts < OUTREACH_AI_MAX_ATTEMPTS && savedLeads.length < targetCount) {
    attempts += 1;
    const remainingAtl = Math.max(0, args.atlCount - countSavedByGroup(savedLeads, "ATL_LOCAL"));
    const remainingVirtual = Math.max(0, args.virtualCount - countSavedByGroup(savedLeads, "VIRTUAL"));
    if (remainingAtl === 0 && remainingVirtual === 0) break;

    const userPrompt = buildPlatformPrompt(
      args.platform,
      remainingAtl,
      remainingVirtual,
      exclusions,
      tailAtl,
      tailVirtual,
      rejectionFeedback,
    );

    const ai = await callAi(system, userPrompt);
    if (!ai.ok) {
      lastAiError = ai.error;
      break;
    }

    const saved = await persistGeneratedLeads(
      args.platform,
      ai.text,
      batchId,
      args.adminId,
      tailAtl,
      tailVirtual,
    );
    lastVerification = {
      ...saved.verification,
      attempts,
      saved: (lastVerification?.saved ?? 0) + saved.leads.length,
      parsed: (lastVerification?.parsed ?? 0) + (saved.verification?.parsed ?? 0),
      rejected: (lastVerification?.rejected ?? 0) + (saved.verification?.rejected ?? 0),
      rejectedSamples: [
        ...(lastVerification?.rejectedSamples ?? []),
        ...(saved.verification?.rejectedSamples ?? []),
      ].slice(0, 8),
    };

    savedLeads = [...savedLeads, ...saved.leads];
    exclusions = [...exclusions, ...collectExclusionsFromLeads(args.platform, saved.leads)];

    if (saved.leads.length >= remainingAtl + remainingVirtual) break;

    rejectionFeedback = buildRejectionFeedback(args.platform, saved.verification);
    if (!rejectionFeedback) break;
  }

  const verification = lastVerification;
  const leads = savedLeads;
  let message: string | undefined;

  if (leads.length === 0) {
    if (lastAiError) {
      message = lastAiError;
    } else if (args.platform === "instagram" && verification) {
      if (verification.parsed === 0) {
        message =
          "AI did not return parseable Instagram leads. Try generating again — the model may have returned prose instead of JSON.";
      } else {
        const sampleReasons = verification.rejectedSamples
          .slice(0, 3)
          .map((s) => `${s.handle}: ${s.reason}`)
          .join("; ");
        message = sampleReasons
          ? `AI returned ${verification.parsed} handle(s), but none passed verification. Examples: ${sampleReasons}`
          : "AI returned Instagram handles, but none resolved to live public fitness pro profiles. Try generating again.";
      }
    } else if (verification?.parsed === 0 || !verification) {
      message =
        lastAiError ??
        "AI did not return any usable leads. Try generating again — if this keeps happening, check the server API key and model.";
    } else {
      message = "No leads were saved from this generation run. Try again.";
    }
  } else if (verification && verification.rejected > 0) {
    message = `Saved ${verification.saved} verified lead(s); skipped ${verification.rejected} that failed verification or niche fit.`;
  } else if (leads.length < targetCount && attempts > 1) {
    message = `Saved ${leads.length} of ${targetCount} requested lead(s) after ${attempts} research pass(es). Generate again for more.`;
  }

  return {
    batchId,
    leads,
    aiUsed: !lastAiError,
    message,
    verification,
  };
}

function countSavedByGroup(leads: unknown[], group: OutreachTargetGroup): number {
  return leads.filter((lead) => {
    if (!lead || typeof lead !== "object") return false;
    const targetGroup = (lead as { targetGroup?: string }).targetGroup;
    return normalizeGroup(targetGroup ?? "VIRTUAL") === group;
  }).length;
}

function collectExclusionsFromLeads(platform: OutreachPlatform, leads: unknown[]): string[] {
  return leads.flatMap((lead) => {
    if (!lead || typeof lead !== "object") return [];
    const row = lead as Record<string, unknown>;
    if (platform === "instagram") {
      return [String(row.handle ?? "").toLowerCase(), String(row.profileUrl ?? "").toLowerCase()];
    }
    if (platform === "facebook") {
      return [String(row.pageUrl ?? "").toLowerCase(), String(row.pageName ?? "").toLowerCase()];
    }
    if (platform === "email") {
      return [String(row.email ?? "").toLowerCase()];
    }
    return [String(row.contactLabel ?? "").toLowerCase(), String(row.contactUrl ?? "").toLowerCase()];
  });
}

function buildRejectionFeedback(
  platform: OutreachPlatform,
  verification?: OutreachLeadVerificationSummary,
): string {
  if (!verification?.rejectedSamples.length) return "";
  const samples = verification.rejectedSamples
    .slice(0, 5)
    .map((s) => `- ${s.handle}: ${s.reason}`)
    .join("\n");
  const label =
    platform === "instagram"
      ? "handles"
      : platform === "facebook"
        ? "Facebook URLs"
        : platform === "email"
          ? "emails"
          : "contacts";
  return [
    `Previous pass saved ${verification.saved} lead(s) but rejected these ${label}:`,
    samples,
    "Find different real fitness professionals. Do not repeat rejected or excluded entries.",
  ].join("\n");
}

function buildPlatformPrompt(
  platform: OutreachPlatform,
  atlCount: number,
  virtualCount: number,
  exclusions: string[],
  tailAtl: string,
  tailVirtual: string,
  rejectionFeedback = "",
): string {
  const excl = exclusions.slice(0, 200).join(", ") || "none yet";
  const retryBlock = rejectionFeedback ? `\n\n${rejectionFeedback}\n` : "";

  if (platform === "instagram") {
    return `Find ${atlCount} ATL-local and ${virtualCount} virtual fitness professionals on Instagram for Match Fit trainer outreach.
Already in database (exclude): ${excl}
${retryBlock}
${OUTREACH_INSTAGRAM_CRITERIA}

For ATL_LOCAL: Atlanta metro personal trainers, strength coaches, gym-based coaches, or hybrid coaches with local presence.
For VIRTUAL: online coaches, remote personal trainers, nutrition coaches, and virtual training brands run by an individual coach.

Return ONLY a JSON array. Each item MUST be a real public profile you are confident exists.

JSON schema per item:
{"handle":"@username","profileUrl":"https://www.instagram.com/username/","niche":"strength coaching","targetGroup":"ATL_LOCAL"|"VIRTUAL","whyMatchFit":"one sentence on why they'd want Match Fit to grow their coaching brand","likelihoodScore":72,"personalHook":"specific coaching content detail for opener","commentText":"short comment for their post","commentPostRef":"Latest post","notes":"optional — include coaching specialty if known"}

Generic invite tail for ATL: "${tailAtl}"
Generic invite tail for Virtual: "${tailVirtual}"`;
  }
  if (platform === "facebook") {
    return `Find ${atlCount} ATL-local and ${virtualCount} virtual Facebook pages or trainer-focused groups for Match Fit outreach.
Already in database (exclude): ${excl}
${retryBlock}
${OUTREACH_FACEBOOK_CRITERIA}

For ATL_LOCAL: Atlanta-area trainer groups, local gym communities, metro fitness business pages where coaches participate.
For VIRTUAL: online coaching communities, remote trainer groups, or virtual fitness business pages.

JSON schema:
{"pageName":"name","pageUrl":"https://facebook.com/groups/...","audience":"TRAINER"|"CLIENT","niche":"personal training","targetGroup":"ATL_LOCAL"|"VIRTUAL","whyMatchFit":"one sentence","likelihoodScore":65,"pagePostText":"full post with personalized opener + generic tail","notes":"optional"}

Generic tail ATL: "${tailAtl}"
Generic tail Virtual: "${tailVirtual}"`;
  }
  if (platform === "email") {
    return `Find ${atlCount} ATL-local and ${virtualCount} virtual fitness professionals with public contact emails.
Already in database (exclude): ${excl}
${retryBlock}
${OUTREACH_EMAIL_CRITERIA}

JSON schema:
{"name":"First Last","email":"trainer@domain.com","businessName":"Gym or brand","niche":"strength coaching","emailSourceUrl":"where email was found","targetGroup":"ATL_LOCAL"|"VIRTUAL","whyMatchFit":"one sentence","likelihoodScore":60,"personalHook":"specific detail","notes":"optional"}

Generic tail ATL: "${tailAtl}"
Generic tail Virtual: "${tailVirtual}"`;
  }
  return `Find ${atlCount + virtualCount} other-channel fitness pro leads (LinkedIn, X, referrals).
Exclude: ${excl}
${retryBlock}

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

    const prepared = items.flatMap((item) => {
      const normalized = normalizeInstagramLeadIdentity({
        handle: item.handle,
        profileUrl: item.profileUrl,
      });
      if (!normalized) {
        rejectedSamples.push({
          handle: item.handle ?? item.profileUrl ?? "unknown",
          reason: "Invalid Instagram handle or profile URL.",
        });
        return [];
      }
      if (seenUsernames.has(normalized.username)) return [];
      seenUsernames.add(normalized.username);
      return [{ item, normalized }];
    });

    const verifiedRows = await mapWithConcurrency(prepared, 2, async ({ item, normalized }, index) => {
      if (index > 0) await sleepMs(450);

      const verified = await verifyInstagramProfile(normalized.username);
      if (!verified.ok) {
        return {
          kind: "rejected" as const,
          handle: normalized.handle,
          reason: verified.reason,
        };
      }

      const fitness = assessFitnessProfessionalProfile(verified);
      if (!fitness.ok) {
        return {
          kind: "rejected" as const,
          handle: normalized.handle,
          reason: fitness.reason,
        };
      }

      const group = normalizeGroup(item.targetGroup ?? "VIRTUAL");
      const tail = group === "ATL_LOCAL" ? tailAtl : tailVirtual;
      const hook =
        item.personalHook ??
        verified.biography?.slice(0, 120) ??
        item.whyMatchFit ??
        "your coaching content";
      const opener = instagramPersonalizedOpener(group, verified.username, hook);
      const dmText = `${opener}${tail}`;
      const row = await prisma.outreachInstagramLead.create({
        data: {
          handle: `@${verified.username}`,
          profileUrl: verified.profileUrl,
          niche: item.niche ?? fitness.niche,
          targetGroup: group,
          whyMatchFit: item.whyMatchFit ?? "Strong fit for Match Fit founding trainer roster.",
          likelihoodScore: clampScore(item.likelihoodScore),
          notes:
            [
              item.notes,
              verified.fullName ? `Verified as ${verified.fullName}` : null,
              verified.categoryName ? `IG category: ${verified.categoryName}` : null,
              `Fitness fit: ${fitness.tier} (${fitness.fitnessScore})`,
              "Public fitness pro profile verified.",
            ]
              .filter(Boolean)
              .join(" · ") || null,
          dmText,
          commentText: item.commentText ?? `Love the coaching you're putting out 🔥`,
          commentPostRef: item.commentPostRef ?? "Latest post",
          genericInviteTail: tail,
          generationBatchId: batchId,
          createdByAdminId: adminId,
        },
      });
      return { kind: "created" as const, row };
    });

    for (const result of verifiedRows) {
      if (result.kind === "created") created.push(result.row);
      else rejectedSamples.push({ handle: result.handle, reason: result.reason });
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
    const rejectedSamples: { handle: string; reason: string }[] = [];
    const seenUrls = new Set<string>();

    for (const item of items) {
      const pageKey = (item.pageUrl ?? item.pageName ?? "").trim().toLowerCase();
      if (!pageKey || seenUrls.has(pageKey)) continue;
      seenUrls.add(pageKey);

      const fitness = assessFitnessProfessionalLeadText({
        pageName: item.pageName,
        niche: item.niche,
        whyMatchFit: item.whyMatchFit,
        notes: item.notes,
      });
      if (!fitness.ok) {
        rejectedSamples.push({ handle: item.pageName ?? item.pageUrl ?? "unknown", reason: fitness.reason });
        continue;
      }

      const verified = await verifyFacebookPageUrl(item.pageUrl ?? "");
      if (!verified.ok) {
        rejectedSamples.push({ handle: item.pageName ?? item.pageUrl ?? "unknown", reason: verified.reason });
        continue;
      }

      const group = normalizeGroup(item.targetGroup ?? "ATL_LOCAL");
      const tail = group === "ATL_LOCAL" ? tailAtl : tailVirtual;
      const opener =
        item.pagePostText?.split("\n\n")[0] ??
        `👋 Calling Atlanta fitness trainers — Match Fit is hand-selecting founding coaches for beta.`;
      const pagePostText =
        item.pagePostText && item.pagePostText.includes(tail)
          ? item.pagePostText
          : `${opener}\n\n${tail}`;

      const row = await prisma.outreachFacebookLead.create({
        data: {
          pageName: item.pageName ?? "Facebook group",
          pageUrl: verified.pageUrl,
          audience: item.audience === "CLIENT" ? "CLIENT" : "TRAINER",
          niche: item.niche ?? fitness.niche,
          targetGroup: group,
          whyMatchFit: item.whyMatchFit ?? "Active audience for Match Fit.",
          likelihoodScore: clampScore(item.likelihoodScore),
          notes:
            [
              item.notes,
              `Fitness fit: ${fitness.tier} (${fitness.fitnessScore})`,
              verified.verifiedLive ? "Facebook URL verified live." : "Facebook URL format validated.",
            ]
              .filter(Boolean)
              .join(" · ") || null,
          pagePostText,
          genericInviteTail: tail,
          generationBatchId: batchId,
          createdByAdminId: adminId,
        },
      });
      created.push(row);
    }

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

  if (platform === "email") {
    const items = parseJsonArray<GeneratedEmailLead & { personalHook?: string }>(raw);
    const created = [];
    const rejectedSamples: { handle: string; reason: string }[] = [];
    const seenEmails = new Set<string>();

    for (const item of items) {
      const emailCheck = assessEmailLeadContact(item.email ?? "");
      if (!emailCheck.ok) {
        rejectedSamples.push({ handle: item.email ?? item.name ?? "unknown", reason: emailCheck.reason });
        continue;
      }
      if (seenEmails.has(emailCheck.email)) continue;
      seenEmails.add(emailCheck.email);

      if (!isLikelyPublicEmailSourceUrl(item.emailSourceUrl)) {
        rejectedSamples.push({
          handle: emailCheck.email,
          reason: "Missing or invalid emailSourceUrl — need a public page where the email was found.",
        });
        continue;
      }

      const fitness = assessFitnessProfessionalLeadText({
        name: item.name,
        email: emailCheck.email,
        businessName: item.businessName,
        niche: item.niche,
        whyMatchFit: item.whyMatchFit,
        notes: item.notes,
      });
      if (!fitness.ok) {
        rejectedSamples.push({ handle: emailCheck.email, reason: fitness.reason });
        continue;
      }

      const group = normalizeGroup(item.targetGroup ?? "ATL_LOCAL");
      const tail = group === "ATL_LOCAL" ? tailAtl : tailVirtual;
      const first = (item.name ?? "there").split(" ")[0];
      const hook = item.personalHook ?? item.whyMatchFit;
      const body = `Hey ${first},\n\nI'm Jonny, founder of Match Fit. ${hook}\n\n${tail}`;
      const row = await prisma.outreachEmailLead.create({
        data: {
          name: item.name ?? "Trainer",
          email: emailCheck.email,
          businessName: item.businessName ?? null,
          niche: item.niche ?? fitness.niche,
          emailSourceUrl: item.emailSourceUrl ?? null,
          targetGroup: group,
          whyMatchFit: item.whyMatchFit ?? "Good fit for founding trainer roster.",
          likelihoodScore: clampScore(item.likelihoodScore),
          notes:
            [item.notes, `Fitness fit: ${fitness.tier} (${fitness.fitnessScore})`, "Public email format verified."]
              .filter(Boolean)
              .join(" · ") || null,
          emailSubject: item.emailSubject ?? emailSubject(group),
          emailBody: item.emailBody ?? body,
          genericInviteTail: tail,
          generationBatchId: batchId,
          createdByAdminId: adminId,
        },
      });
      created.push(row);
    }

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
