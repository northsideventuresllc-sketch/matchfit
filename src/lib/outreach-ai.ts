import "server-only";

import { getAdminAiProviderStatus } from "@/lib/admin-analytics-ai";
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
import { getOutreachExclusionList } from "@/lib/outreach-exclusions";
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

const OUTREACH_AI_MAX_ATTEMPTS = 2;
const ANTHROPIC_OUTREACH_TIMEOUT_MS = 180_000;

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

type OutreachAiResult = {
  text: string | null;
  usedWebSearch: boolean;
  provider: string;
  error?: string;
};

function extractAnthropicText(data: { content?: { type: string; text?: string }[] }): string | null {
  const blocks = data.content?.filter((block) => block.type === "text" && block.text?.trim()) ?? [];
  if (blocks.length === 0) return null;
  return blocks.map((block) => block.text!.trim()).join("\n\n");
}

/** Calls Anthropic with live web search when available; OpenAI is a weaker memory-only fallback. */
async function callOutreachAi(system: string, user: string): Promise<OutreachAiResult> {
  await hydratePlatformEnvFromDatabase();
  const status = getAdminAiProviderStatus();
  if (!status.configured) {
    return {
      text: null,
      usedWebSearch: false,
      provider: "none",
      error: "AI provider not configured. Add ANTHROPIC_API_KEY or OPENAI_API_KEY.",
    };
  }

  const outreachModel = resolveOutreachAiModel(status.provider);

  if (status.provider === "anthropic") {
    const key = process.env.ANTHROPIC_API_KEY?.trim();
    if (!key) {
      return {
        text: null,
        usedWebSearch: false,
        provider: "anthropic",
        error: "ANTHROPIC_API_KEY is missing on the server.",
      };
    }

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: outreachModel,
          max_tokens: 8000,
          system,
          messages: [{ role: "user", content: user }],
          temperature: 0.2,
          tools: [
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
        }),
        signal: AbortSignal.timeout(ANTHROPIC_OUTREACH_TIMEOUT_MS),
      });

      if (!res.ok) {
        const detail = (await res.text().catch(() => "")).slice(0, 240);
        console.error("[outreach-ai] Anthropic web search request failed:", res.status, detail);
        return {
          text: null,
          usedWebSearch: true,
          provider: "anthropic",
          error: `Anthropic web search failed (HTTP ${res.status}). Check the API key and model (${outreachModel}).`,
        };
      }

      const data = (await res.json()) as { content?: { type: string; text?: string }[] };
      const text = extractAnthropicText(data);
      if (!text?.trim()) {
        return {
          text: null,
          usedWebSearch: true,
          provider: "anthropic",
          error: "Anthropic web search returned an empty response.",
        };
      }
      return { text, usedWebSearch: true, provider: "anthropic" };
    } catch (error) {
      const timedOut = error instanceof Error && error.name === "TimeoutError";
      console.error("[outreach-ai] Anthropic web search request error:", error);
      return {
        text: null,
        usedWebSearch: true,
        provider: "anthropic",
        error: timedOut
          ? "Anthropic web search timed out. Try smaller lead counts (e.g. 2 ATL + 3 virtual)."
          : "Anthropic web search failed unexpectedly. Try again with smaller counts.",
      };
    }
  }

  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    return {
      text: null,
      usedWebSearch: false,
      provider: "openai",
      error: "OPENAI_API_KEY is missing on the server.",
    };
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
      temperature: 0.3,
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
      text: null,
      usedWebSearch: false,
      provider: "openai",
      error: `OpenAI API rejected the request (HTTP ${res.status}). Check the API key and model (${outreachModel}).`,
    };
  }

  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = data.choices?.[0]?.message?.content ?? null;
  if (!text?.trim()) {
    return {
      text: null,
      usedWebSearch: false,
      provider: "openai",
      error: "OpenAI returned an empty response.",
    };
  }
  return { text, usedWebSearch: false, provider: "openai" };
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
  atlCount: number;
  virtualCount: number;
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
  let usedWebSearch = false;
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

    if ((saved.verification?.parsed ?? 0) === 0) {
      rejectionFeedback =
        "Your previous response was not a parseable JSON array. Return ONLY a raw JSON array of lead objects starting with [ and ending with ]. No prose, markdown fences, or explanation.";
      continue;
    }

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

QUALITY BAR — every lead must meet this standard. Study these examples:

EXAMPLE 1 (Virtual, @rachelratios):
- niche: "Women's body recomposition / fat loss without tracking"
- whyMatchFit: "Highly engaged despite 1.2K followers. Distinct 'no food diary' methodology is a real hook. Currently has 2 open coaching spots — actively looking for clients right now."
- personalHook: "Your Feb→May recomp results and the 30+ client system behind it — that's a real methodology, not just motivation content. The fact that you have 2 spots open right now is exactly why I'm reaching out."
- commentText: "The glutes built vs padded breakdown is such an important distinction — this is what real recomp looks like 🔥"
- commentPostRef: "Feb→May body recomp results post (17 hours ago)"

EXAMPLE 2 (ATL Local, @customcorefitness):
- niche: "Personal training / full-body / bootcamp"
- whyMatchFit: "3.9K followers, ATL Personal Trainer in bio, runs a Saturday bootcamp at a specific ATL address. Active community with live conversations in comments."
- personalHook: "Saw someone asking about cost in the comments on the Saturday bootcamp post and you replied right away — that's the kind of active community Match Fit is built to support."
- commentText: "A Saturday bootcamp at a real location with a real community — this is what ATL fitness needs more of 💪"
- commentPostRef: "Saturday bootcamp promotion post (12 hours ago)"

EXAMPLE 3 (Virtual, @isasmithfit):
- niche: "Competition prep / nutrition / online coaching"
- whyMatchFit: "Registered Dietitian + Online Coach — rare credential combo. 7.6K followers with strong comp prep content. RD credential is a major differentiator on a marketplace."
- personalHook: "An RD who also coaches comp prep is a rare combo — most athletes have to juggle two separate professionals. That's a real edge on a marketplace where clients are searching by specialty."
- commentText: "RD + prep coach is such a powerful combo — your clients are getting the full picture 🙌"
- commentPostRef: "Back to work prep season post (today)"

RULES FOR QUALITY:
- personalHook must reference a SPECIFIC recent post or content piece — never generic praise. Name what the post was about.
- whyMatchFit must state a concrete business signal: follower count, credential, open spots, active booking link, client results content, named location.
- commentText must be specific to what commentPostRef contains — no generic "great content" lines.
- commentPostRef must describe the post: topic + how recent (e.g. "3-phase transformation case study (posted yesterday)").
- Prefer coaches who are actively building a client business (booking links, open spots announcements, DM CTAs, recent client result posts).

Return ONLY a JSON array. Each item MUST be a real public profile you are confident exists.

JSON schema per item:
{"handle":"@username","profileUrl":"https://www.instagram.com/username/","niche":"specific niche","targetGroup":"ATL_LOCAL"|"VIRTUAL","whyMatchFit":"concrete business signal in 1-2 sentences","likelihoodScore":72,"personalHook":"specific reference to a recent post or content piece","commentText":"specific comment tied to commentPostRef","commentPostRef":"post topic + recency","notes":"optional — credential, specialty, or recent milestone"}

Generic invite tail for ATL: "${tailAtl}"
Generic invite tail for Virtual: "${tailVirtual}"

Respond with ONLY the JSON array. No text before or after the array.`;
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

  throw new Error(`Unsupported outreach platform: ${platform}`);
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

  throw new Error(`Unsupported outreach platform: ${platform}`);
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
}> {
  const [ig, fb, em] = await Promise.all([
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
  };
}
