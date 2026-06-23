import type { FpAccountTier } from "@/lib/fp-account-tier-types";
import { isFpAccountTier } from "@/lib/fp-account-tier-types";
import { trainerHasEliteChatPolicy } from "@/lib/fp-tier-chat-policy";

const KEYWORD_SIGNALS: readonly { token: string; label: string }[] = [
  { token: "venmo", label: "VENMO" },
  { token: "cash app", label: "CASH_APP" },
  { token: "cashapp", label: "CASHAPP" },
  { token: "paypal", label: "PAYPAL" },
  { token: "zelle", label: "ZELLE" },
  { token: "apple pay", label: "APPLE_PAY" },
  { token: "google pay", label: "GOOGLE_PAY" },
];

/** US NANP-style numbers (10 digits; optional +1 and parentheses around area code). */
const PHONE_LIKE = /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/;

/** Email-like: local@domain with a 2+ letter TLD (covers .com, .edu, .io, etc.). */
const EMAIL_LIKE = /\b[A-Z0-9][A-Z0-9._%+-]*@[A-Z0-9][A-Z0-9.-]*\.[A-Z]{2,}\b/i;

/** Spelled-out obfuscation: "name at domain dot com". */
const EMAIL_SPELLED = /\b[A-Z0-9][\w.%+-]*\s+at\s+[A-Z0-9][\w.-]*\s+dot\s+[A-Z]{2,}\b/i;

const EXTERNAL_URL = /\bhttps?:\/\/[^\s<>"']+/gi;
const MATCH_FIT_HOST = /match[-\s]?fit\.(net|com)/i;

export const CHAT_CONTACT_BLOCK_MESSAGE =
  "Remove phone numbers, email addresses, and off-platform payment details. Keep payments and scheduling on Match Fit.";

export const CHAT_ELITE_CONTACT_BLOCK_MESSAGE =
  "Remove phone numbers and off-platform payment details. Business email addresses and external listing links are allowed on Elite Fitness Pro.";

export type ChatLeakageScanResult = {
  flagged: boolean;
  signals: string[];
};

function isMatchFitUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return MATCH_FIT_HOST.test(host);
  } catch {
    return MATCH_FIT_HOST.test(url);
  }
}

export function scanChatTextForLeakageSignals(
  raw: string,
  accountTier?: string | null,
): ChatLeakageScanResult {
  const signals = new Set<string>();
  const lower = raw.toLowerCase();
  const elitePolicy = accountTier ? trainerHasEliteChatPolicy(accountTier) : false;

  for (const { token, label } of KEYWORD_SIGNALS) {
    if (lower.includes(token)) signals.add(label);
  }

  const compact = raw.replace(/\s+/g, "");
  if (PHONE_LIKE.test(raw)) signals.add("PHONE_LIKE");
  if (/\d{10,}/.test(compact)) signals.add("LONG_DIGIT_RUN");

  if (EMAIL_LIKE.test(raw) || EMAIL_SPELLED.test(raw)) {
    if (!elitePolicy) signals.add("EMAIL_LIKE");
  }

  const urls = raw.match(EXTERNAL_URL) ?? [];
  for (const url of urls) {
    if (!isMatchFitUrl(url)) {
      if (elitePolicy) signals.add("EXTERNAL_LISTING_LINK");
      else signals.add("EXTERNAL_URL");
    }
  }

  const blockingSignals = elitePolicy
    ? [...signals].filter((s) => s !== "EXTERNAL_LISTING_LINK")
    : [...signals];

  return { flagged: blockingSignals.length > 0, signals: blockingSignals };
}

/** Server-side gate for outbound chat/nudge text — blocks before persistence. */
export function getChatContactLeakageBlockReason(raw: string, accountTier?: string | null): string | null {
  const leak = scanChatTextForLeakageSignals(raw, accountTier);
  if (!leak.flagged) return null;
  return accountTier && trainerHasEliteChatPolicy(accountTier)
    ? CHAT_ELITE_CONTACT_BLOCK_MESSAGE
    : CHAT_CONTACT_BLOCK_MESSAGE;
}

export function isFpAccountTierForChat(tier: string | null | undefined): tier is FpAccountTier {
  return Boolean(tier && isFpAccountTier(tier));
}
