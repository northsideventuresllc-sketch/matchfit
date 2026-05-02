const KEYWORD_SIGNALS: readonly { token: string; label: string }[] = [
  { token: "venmo", label: "VENMO" },
  { token: "cash app", label: "CASH_APP" },
  { token: "cashapp", label: "CASHAPP" },
  { token: "paypal", label: "PAYPAL" },
  { token: "zelle", label: "ZELLE" },
  { token: "apple pay", label: "APPLE_PAY" },
  { token: "google pay", label: "GOOGLE_PAY" },
];

/** US-style phone patterns (loose) — 10 digits or common separators. */
const PHONE_LIKE = /\b(?:\+?1[\s.-]?)?(?:\(\s*\d{3}\s*\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4}\b/g;

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
  if (raw.match(PHONE_LIKE)) signals.add("PHONE_LIKE");

  /** digit runs of 10+ often telephone without separators */
  if (/\d{10,}/.test(compact)) signals.add("LONG_DIGIT_RUN");

  if (lower.includes("@") && (lower.includes(".com") || lower.includes(".net") || lower.includes(".org"))) {
    signals.add("EMAIL_LIKE");
  }

  return { flagged: signals.size > 0, signals: [...signals] };
}
