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

export const CHAT_CONTACT_BLOCK_MESSAGE =
  "Remove phone numbers, email addresses, and off-platform payment details. Keep payments and scheduling on Match Fit.";

export type ChatLeakageScanResult = {
  flagged: boolean;
  signals: string[];
};

export function scanChatTextForLeakageSignals(raw: string): ChatLeakageScanResult {
  const signals = new Set<string>();
  const lower = raw.toLowerCase();

  for (const { token, label } of KEYWORD_SIGNALS) {
    if (lower.includes(token)) signals.add(label);
  }

  const compact = raw.replace(/\s+/g, "");
  if (PHONE_LIKE.test(raw)) signals.add("PHONE_LIKE");

  /** digit runs of 10+ often telephone without separators */
  if (/\d{10,}/.test(compact)) signals.add("LONG_DIGIT_RUN");

  if (EMAIL_LIKE.test(raw) || EMAIL_SPELLED.test(raw)) {
    signals.add("EMAIL_LIKE");
  }

  return { flagged: signals.size > 0, signals: [...signals] };
}

/** Server-side gate for outbound chat/nudge text — blocks before persistence. */
export function getChatContactLeakageBlockReason(raw: string): string | null {
  const leak = scanChatTextForLeakageSignals(raw);
  return leak.flagged ? CHAT_CONTACT_BLOCK_MESSAGE : null;
}
