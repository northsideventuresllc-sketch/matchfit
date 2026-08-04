import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { callMatchFitAi } from "@/lib/ai-vault/router";
import { getAiVaultStatus } from "@/lib/ai-vault";
import { hydratePlatformEnvFromDatabase } from "@/lib/hydrate-platform-env";
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
import { normalizeCoachLanguage } from "@/lib/content-calendar/content-rules";
import { getOutreachExclusionList } from "@/lib/outreach-exclusions";
import { buildOutreachLearningContext } from "@/lib/outreach-learning";
import {
  genericInviteTail,
  OUTREACH_BRAND_FACTS,
} from "@/lib/outreach-templates";
import type { OutreachPlatform, OutreachTargetGroup } from "@/lib/outreach-types";
import { prisma } from "@/lib/prisma";
import {
  OUTREACH_COWORK_DAILY_CAPS,
  OUTREACH_COWORK_EMAIL_BCC,
  OUTREACH_COWORK_EMAIL_FROM,
  buildCoworkBriefInstructions,
  buildCoworkRunnerPrompt,
} from "@/lib/outreach-cowork";
import {
  OUTREACH_READY_LEAD_TARGET,
  pickCoworkBriefLeads,
} from "@/lib/outreach-ready-leads";

/** Extra passes help recover from verification rejects / short JSON arrays (IG underfill). */
const OUTREACH_AI_MAX_ATTEMPTS = 4;
const ANTHROPIC_OUTREACH_TIMEOUT_MS = 180_000;

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

type OutreachAiResult = {
  text: string | null;
  usedWebSearch: boolean;
  provider: string;
  error?: string;
};

/** Claude (with web search when available) → Gemini primary → Gemini backup. */
async function callOutreachAi(system: string, user: string): Promise<OutreachAiResult> {
  const vault = getAiVaultStatus();
  if (!vault.configured) {
    return {
      text: null,
      usedWebSearch: false,
      provider: "none",
      error: "AI Vault is not configured. Add ANTHROPIC_API_KEY and GEMINI_API_KEY.",
    };
  }

  const ai = await callMatchFitAi({
    system,
    user,
    maxTokens: 8000,
    temperature: 0.2,
    timeoutMs: ANTHROPIC_OUTREACH_TIMEOUT_MS,
    kind: "research",
    complexity: "complex",
    modelOverride: process.env.ANTHROPIC_OUTREACH_MODEL?.trim() || undefined,
    anthropicTools: [
      {
        type: "web_search_20250305",
        name: "web_search",
        max_uses: 8,
        user_location: {
          type: "approximate",
          city: "Atlanta",
          region: "Georgia",
          country: "US",
          timezone: "America/New_York",
        },
      },
    ],
  });

  if (ai.text) {
    return {
      text: ai.text,
      usedWebSearch: ai.provider === "anthropic",
      provider: ai.provider ?? "anthropic",
    };
  }

  return {
    text: null,
    usedWebSearch: ai.attempts.some((a) => a.provider === "anthropic"),
    provider: ai.provider ?? "none",
    error: ai.error ?? "All AI providers failed for outreach generation.",
  };
}

function extractBalancedJsonArray(text: string): string | null {
  const start = text.indexOf("[");
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i += 1) {
    const char = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === "[") depth += 1;
    if (char === "]") {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }

  return null;
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

  const candidates = [
    clean,
    extractBalancedJsonArray(clean),
    clean.lastIndexOf("[") >= 0 ? extractBalancedJsonArray(clean.slice(clean.lastIndexOf("["))) : null,
    clean.match(/\[[\s\S]*\]/)?.[0] ?? null,
  ].filter((value): value is string => Boolean(value?.trim()));

  for (const candidate of candidates) {
    const parsed = tryParse(candidate.trim());
    if (parsed) return parsed;
  }

  return [];
}

async function getExclusionList(platform: OutreachPlatform): Promise<string[]> {
  const activeOnly = await getOutreachExclusionList(platform);
  if (platform === "instagram") {
    const archived = await prisma.outreachInstagramLead.findMany({
      where: { deletedAt: { not: null } },
      select: { handle: true, profileUrl: true },
    });
    const archivedValues = archived.flatMap((r) => [r.handle.toLowerCase(), r.profileUrl.toLowerCase()]);
    return [...new Set([...activeOnly, ...archivedValues])];
  }
  if (platform === "facebook") {
    const archived = await prisma.outreachFacebookLead.findMany({
      where: { deletedAt: { not: null } },
      select: { pageUrl: true, pageName: true },
    });
    const archivedValues = archived.flatMap((r) => [r.pageUrl.toLowerCase(), r.pageName.toLowerCase()]);
    return [...new Set([...activeOnly, ...archivedValues])];
  }
  if (platform === "email") {
    const archived = await prisma.outreachEmailLead.findMany({
      where: { deletedAt: { not: null } },
      select: { email: true },
    });
    const archivedValues = archived.map((r) => r.email.toLowerCase());
    return [...new Set([...activeOnly, ...archivedValues])];
  }
  return activeOnly;
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
    "You are Match Fit's outreach research assistant. Your job is to find real, high-quality leads — not generic profiles.",
    OUTREACH_BRAND_FACTS,
    learning,
    criteria,
    "CRITICAL: Use web search before answering. Only return fitness professionals you can verify from live public web results.",
    "Never invent Instagram handles, Facebook pages, or email addresses.",
    "OUTPUT FORMAT — CRITICAL: Your entire response must be a single raw JSON array starting with [ and ending with ]. No prose, no explanation, no markdown fences (no ```), no preamble, no postamble. If you add anything outside the JSON array the response is unusable.",
    "Never suggest handles, emails, or URLs already in the exclusion list.",
    platform === "instagram"
      ? [
          "Find real, public Instagram profiles of fitness professionals. NEVER invent usernames — only handles you are confident exist.",
          "The best leads are coaches who are ACTIVELY BUILDING a client business right now: posting recent client results, announcing open spots, running DM funnels, or launching new programs.",
          "Every personalHook must reference something SPECIFIC and RECENT from their content — a specific post topic, a client win they shared, a methodology they explained, a challenge they launched. Never write a generic opener.",
        ].join(" ")
      : platform === "facebook"
        ? "Find real Facebook pages or groups where fitness trainers gather. NEVER invent URLs."
        : platform === "email"
          ? "Find real fitness professionals with publicly listed emails. NEVER invent email addresses."
          : "Find real fitness professional contacts. NEVER invent URLs or emails.",
    platform === "instagram"
      ? "Each lead needs: whyMatchFit with at least one concrete business signal (follower range, credential, active booking, client results), personalHook referencing a specific recent post, and likelihoodScore (0-100)."
      : "Each lead needs: whyMatchFit with at least one concrete business signal (follower range, credential, active booking, client results), and likelihoodScore (0-100).",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function generateOutreachLeads(args: {
  platform: OutreachPlatform;
  leadCount: number;
  adminId: string;
}): Promise<{
  batchId: string;
  leads: unknown[];
  aiUsed: boolean;
  usedWebSearch?: boolean;
  message?: string;
  verification?: OutreachLeadVerificationSummary;
}> {
  await hydratePlatformEnvFromDatabase();
  /** Prefix `batch_hq_` = Outreach HQ generate (provenance). Other prefixes = off-path agents. */
  const batchId = `batch_hq_${Date.now()}_${args.adminId.slice(0, 6)}`;
  let exclusions = await getExclusionList(args.platform);
  const learning = await buildOutreachLearningContext(args.platform, args.adminId);
  const tailVirtual = genericInviteTail(args.platform, "VIRTUAL");
  const targetCount = args.leadCount;
  const system = buildOutreachSystemPrompt(args.platform, learning);

  let savedLeads: unknown[] = [];
  let lastVerification: OutreachLeadVerificationSummary | undefined;
  let lastAiError: string | undefined;
  let usedWebSearch = false;
  let attempts = 0;
  let rejectionFeedback = "";

  while (attempts < OUTREACH_AI_MAX_ATTEMPTS && savedLeads.length < targetCount) {
    attempts += 1;
    const remaining = Math.max(0, targetCount - savedLeads.length);
    if (remaining === 0) break;

    const userPrompt = buildPlatformPrompt(
      args.platform,
      remaining,
      exclusions,
      tailVirtual,
      rejectionFeedback,
    );

    const ai = await callOutreachAi(system, userPrompt);
    if (ai.usedWebSearch) usedWebSearch = true;
    if (!ai.text) {
      lastAiError =
        ai.error ??
        (ai.provider === "openai"
          ? "OpenAI fallback cannot web-search real profiles. Add ANTHROPIC_API_KEY for verified Instagram discovery."
          : "AI provider not configured or request failed.");
      break;
    }

    const saved = await persistGeneratedLeads(
      args.platform,
      ai.text,
      batchId,
      args.adminId,
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

    if (savedLeads.length >= targetCount) break;

    if ((saved.verification?.parsed ?? 0) === 0) {
      rejectionFeedback =
        "Your previous response was not a parseable JSON array. Return ONLY a raw JSON array of lead objects starting with [ and ending with ]. No prose, markdown fences, or explanation.";
      continue;
    }

    const stillNeed = targetCount - savedLeads.length;
    rejectionFeedback =
      buildRejectionFeedback(args.platform, saved.verification) ||
      `You returned fewer accepted leads than requested. Saved ${saved.leads.length} this pass; still need ${stillNeed} NEW US fitness pros not in the exclusion list. Return exactly ${stillNeed} additional lead object(s) as a raw JSON array.`;
  }

  const verification = lastVerification;
  const leads = savedLeads;
  let message: string | undefined;

  if (leads.length === 0) {
    if (lastAiError) {
      message = lastAiError;
    } else if (args.platform === "instagram" && verification) {
      if (verification.parsed === 0) {
        message = usedWebSearch
          ? "Web search ran but the model returned prose instead of JSON. Try generating again — smaller counts (e.g. 3 ATL + 5 virtual) often help."
          : "AI did not return parseable Instagram leads. Configure ANTHROPIC_API_KEY for live web search, then try again.";
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
  } else if (!usedWebSearch && leads.length > 0) {
    message = "Warning: OpenAI fallback used memory-only discovery. Prefer Anthropic for real verified profiles.";
  } else if (leads.length < targetCount && attempts > 1) {
    message = `Saved ${leads.length} of ${targetCount} requested lead(s) after ${attempts} research pass(es). Generate again for more.`;
  }

  return {
    batchId,
    leads,
    aiUsed: !lastAiError,
    usedWebSearch,
    message,
    verification,
  };
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
  leadCount: number,
  exclusions: string[],
  tailVirtual: string,
  rejectionFeedback = "",
): string {
  const excl = exclusions.slice(0, 200).join(", ") || "none yet";
  const retryBlock = rejectionFeedback ? `\n\n${rejectionFeedback}\n` : "";

  if (platform === "instagram") {
    return `Find ${leadCount} US-based fitness professionals on Instagram for Match Fit trainer outreach.
Already in database (exclude): ${excl}
${retryBlock}
${OUTREACH_INSTAGRAM_CRITERIA}

Focus on personal trainers, online coaches, nutrition coaches, and hybrid coaches based in the United States.

QUALITY BAR:
- personalHook must reference a SPECIFIC recent post or content piece.
- whyMatchFit must state a concrete business signal: follower count, credential, open spots, active booking link, client results content.
- commentPostRef must describe a post: topic + how recent.

Return ONLY a JSON array. Do NOT draft DM or comment copy — lead discovery only.

JSON schema per item:
{"handle":"@username","profileUrl":"https://www.instagram.com/username/","niche":"specific niche","targetGroup":"VIRTUAL","whyMatchFit":"concrete business signal in 1-2 sentences","likelihoodScore":72,"personalHook":"specific reference to a recent post or content piece","commentPostRef":"post topic + recency","notes":"optional"}

Generic invite tail (for later copy generation): "${tailVirtual}"

Respond with ONLY the JSON array.`;
  }
  if (platform === "facebook") {
    return `Find ${leadCount} US-based Facebook pages or trainer-focused groups for Match Fit outreach.
Already in database (exclude): ${excl}
${retryBlock}
${OUTREACH_FACEBOOK_CRITERIA}

JSON schema:
{"pageName":"name","pageUrl":"https://facebook.com/groups/...","audience":"TRAINER"|"CLIENT","niche":"personal training","targetGroup":"VIRTUAL","whyMatchFit":"one sentence","likelihoodScore":65,"notes":"optional"}

Do NOT draft page post copy — lead discovery only.
Generic tail: "${tailVirtual}"`;
  }
  if (platform === "email") {
    return `Find ${leadCount} US-based fitness professionals with public contact emails.
Already in database (exclude): ${excl}
${retryBlock}
${OUTREACH_EMAIL_CRITERIA}

JSON schema:
{"name":"First Last","email":"trainer@domain.com","businessName":"Gym or brand","niche":"strength coaching","emailSourceUrl":"where email was found","targetGroup":"VIRTUAL","whyMatchFit":"one sentence","likelihoodScore":60,"personalHook":"specific detail","notes":"optional"}

Do NOT draft email copy — lead discovery only.
Generic tail: "${tailVirtual}"`;
  }

  throw new Error(`Unsupported outreach platform: ${platform}`);
}

async function persistGeneratedLeads(
  platform: OutreachPlatform,
  raw: string,
  batchId: string,
  adminId: string,
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

    const verifiedRows = await mapWithConcurrency(prepared, 3, async ({ item, normalized }, index) => {
      if (index > 0) await sleepMs(250);

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

      const hook =
        item.personalHook ??
        verified.biography?.slice(0, 120) ??
        item.whyMatchFit ??
        "your coaching content";
      const row = await prisma.outreachInstagramLead.create({
        data: {
          handle: `@${verified.username}`,
          profileUrl: verified.profileUrl,
          niche: item.niche ?? fitness.niche,
          targetGroup: "VIRTUAL",
          whyMatchFit: normalizeCoachLanguage(
            item.whyMatchFit ?? "Strong fit for Match Fit founding Fitness Pro roster.",
          ),
          likelihoodScore: clampScore(item.likelihoodScore),
          notes:
            [
              "via:hq_generate",
              item.notes,
              hook ? `Hook: ${hook}` : null,
              verified.fullName ? `Verified as ${verified.fullName}` : null,
              verified.categoryName ? `IG category: ${verified.categoryName}` : null,
              `Fitness fit: ${fitness.tier} (${fitness.fitnessScore})`,
              "Public coach profile verified.",
            ]
              .filter(Boolean)
              .join(" · ") || null,
          dmText: "",
          commentText: "",
          followUp1DmText: "",
          followUp2DmText: "",
          commentPostRef: item.commentPostRef ?? "Latest post",
          genericInviteTail: tailVirtual,
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
      await prisma.outreachDailyTemplate.create({
        data: {
          platform: "instagram",
          targetGroup: "VIRTUAL",
          genericInviteTail: tailVirtual,
          generationBatchId: `${batchId}_us`,
        },
      });
    } catch (e) {
      console.warn("[outreach-ai] outreachDailyTemplate create skipped:", e);
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
    const rejectedSamples: { handle: string; reason: string }[] = [];
    const seenUrls = new Set<string>();
    const payloads: Prisma.OutreachFacebookLeadCreateManyInput[] = [];

    // Validation stays sequential so rejectedSamples keeps its original order and
    // the page verification calls are unchanged; only the writes are batched.
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

      payloads.push({
        pageName: item.pageName ?? "Facebook group",
        pageUrl: verified.pageUrl,
        audience: item.audience === "CLIENT" ? "CLIENT" : "TRAINER",
        niche: item.niche ?? fitness.niche,
        targetGroup: "VIRTUAL",
        whyMatchFit: normalizeCoachLanguage(item.whyMatchFit ?? "Active audience for Match Fit."),
        likelihoodScore: clampScore(item.likelihoodScore),
        notes:
          [
            "via:hq_generate",
            item.notes,
            `Fitness fit: ${fitness.tier} (${fitness.fitnessScore})`,
            verified.verifiedLive ? "Facebook URL verified live." : "Facebook URL format validated.",
          ]
            .filter(Boolean)
            .join(" · ") || null,
        pagePostText: "",
        genericInviteTail: tailVirtual,
        generationBatchId: batchId,
        createdByAdminId: adminId,
      });
    }

    // One insert for the whole batch; createManyAndReturn keeps input order.
    const created = payloads.length
      ? await prisma.outreachFacebookLead.createManyAndReturn({ data: payloads })
      : [];

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
    const rejectedSamples: { handle: string; reason: string }[] = [];
    const seenEmails = new Set<string>();
    const payloads: Prisma.OutreachEmailLeadCreateManyInput[] = [];

    // Validation stays sequential so rejectedSamples keeps its original order;
    // only the writes are batched.
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

      payloads.push({
        name: item.name ?? "Trainer",
        email: emailCheck.email,
        businessName: item.businessName ?? null,
        niche: item.niche ?? fitness.niche,
        emailSourceUrl: item.emailSourceUrl ?? null,
        targetGroup: "VIRTUAL",
        whyMatchFit: normalizeCoachLanguage(item.whyMatchFit ?? "Good fit for founding Fitness Pro roster."),
        likelihoodScore: clampScore(item.likelihoodScore),
        notes:
          [
            "via:hq_generate",
            item.notes,
            item.personalHook ? `Hook: ${item.personalHook}` : null,
            `Fitness fit: ${fitness.tier} (${fitness.fitnessScore})`,
            "Public email format verified.",
          ]
            .filter(Boolean)
            .join(" · ") || null,
        emailSubject: "",
        emailBody: "",
        followUp1EmailSubject: "",
        followUp1EmailBody: "",
        followUp2EmailSubject: "",
        followUp2EmailBody: "",
        genericInviteTail: tailVirtual,
        generationBatchId: batchId,
        createdByAdminId: adminId,
      });
    }

    // One insert for the whole batch; createManyAndReturn keeps input order.
    const created = payloads.length
      ? await prisma.outreachEmailLead.createManyAndReturn({ data: payloads })
      : [];

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

  throw new Error(`Unsupported outreach platform: ${platform}`);
}

function clampScore(n: number | undefined): number {
  if (typeof n !== "number" || Number.isNaN(n)) return 50;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export async function buildCoworkMorningBrief(): Promise<{
  generatedAt: string;
  instructions: string;
  runnerPrompt: string;
  caps: typeof OUTREACH_COWORK_DAILY_CAPS;
  emailFrom: string;
  emailBcc: readonly string[];
  missingIntentCount: number;
  readyJoinFpOrBoth: {
    instagram: number;
    email: number;
    total: number;
    target: number;
    meetsTarget: boolean;
  };
  instagram: unknown[];
  facebook: unknown[];
  email: unknown[];
}> {
  const [igPool, fb, emPool, igReadyCount, emReadyCount] = await Promise.all([
    prisma.outreachInstagramLead.findMany({
      where: { deletedAt: null, status: "LEAD", archivedAt: null },
      orderBy: [{ savedToHubAt: "desc" }, { createdAt: "desc" }],
      take: Math.max(OUTREACH_COWORK_DAILY_CAPS.instagram * 4, 20),
    }),
    prisma.outreachFacebookLead.findMany({
      where: { deletedAt: null, status: "LEAD", archivedAt: null },
      orderBy: [{ savedToHubAt: "desc" }, { createdAt: "desc" }],
      take: OUTREACH_COWORK_DAILY_CAPS.facebook,
    }),
    prisma.outreachEmailLead.findMany({
      where: { deletedAt: null, status: "LEAD", archivedAt: null },
      orderBy: [{ savedToHubAt: "desc" }, { createdAt: "desc" }],
      take: Math.max(OUTREACH_COWORK_DAILY_CAPS.email * 4, 12),
    }),
    prisma.outreachInstagramLead.count({
      where: {
        deletedAt: null,
        archivedAt: null,
        status: "LEAD",
        savedToHubAt: { not: null },
        outreachIntent: { in: ["JOIN_AS_FP", "BOTH"] },
        NOT: { dmText: "" },
      },
    }),
    prisma.outreachEmailLead.count({
      where: {
        deletedAt: null,
        archivedAt: null,
        status: "LEAD",
        savedToHubAt: { not: null },
        outreachIntent: { in: ["JOIN_AS_FP", "BOTH"] },
        NOT: { OR: [{ emailSubject: "" }, { emailBody: "" }] },
      },
    }),
  ]);

  const ig = pickCoworkBriefLeads("instagram", igPool, OUTREACH_COWORK_DAILY_CAPS.instagram);
  const em = pickCoworkBriefLeads("email", emPool, OUTREACH_COWORK_DAILY_CAPS.email);

  const generatedAt = new Date().toISOString();
  const missingIntentCount = [...ig, ...em].filter((row) => !row.outreachIntent).length;
  const readyJoinFpOrBoth = {
    instagram: igReadyCount,
    email: emReadyCount,
    total: igReadyCount + emReadyCount,
    target: OUTREACH_READY_LEAD_TARGET,
    meetsTarget: igReadyCount + emReadyCount >= OUTREACH_READY_LEAD_TARGET,
  };

  return {
    generatedAt,
    instructions: buildCoworkBriefInstructions(),
    runnerPrompt: buildCoworkRunnerPrompt(generatedAt),
    caps: OUTREACH_COWORK_DAILY_CAPS,
    emailFrom: OUTREACH_COWORK_EMAIL_FROM,
    emailBcc: OUTREACH_COWORK_EMAIL_BCC,
    missingIntentCount,
    readyJoinFpOrBoth,
    instagram: ig,
    facebook: fb,
    email: em,
  };
}
