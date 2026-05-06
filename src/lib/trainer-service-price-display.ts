const usd2 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Profile and UI: always two decimal places. */
export function formatTrainerServicePriceUsd(amount: number): string {
  return usd2.format(amount);
}

/** Strip currency noise for parsing user input. */
export function parseTrainerServicePriceUsdInput(raw: string): number | null {
  const t = raw.replace(/[$,\s]/g, "").trim();
  if (!t || t === ".") return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return n;
}

/**
 * Allow only digits and a single decimal with up to two fractional digits (typing-safe).
 */
export function sanitizeTrainerServicePriceUsdTyping(value: string): string {
  let v = value.replace(/[^0-9.]/g, "");
  const dot = v.indexOf(".");
  if (dot !== -1) {
    v = v.slice(0, dot + 1) + v.slice(dot + 1).replace(/\./g, "");
  }
  const [whole, frac] = v.split(".");
  if (frac !== undefined) {
    return `${whole ?? ""}.${frac.slice(0, 2)}`;
  }
  return v;
}
