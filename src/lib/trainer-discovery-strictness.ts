import type { ClientMatchPreferences } from "@/lib/client-match-preferences";
import { clientPreferenceSearchTokens } from "@/lib/client-match-preferences";

export const TRAINER_DISCOVERY_STRICTNESS_MIN = 1;
export const TRAINER_DISCOVERY_STRICTNESS_MAX = 5;

export const TRAINER_DISCOVERY_STRICTNESS_LABELS: Record<number, string> = {
  1: "KIND OF CLOSELY",
  2: "SOMEWHAT CLOSELY",
  3: "MODERATELY CLOSELY",
  4: "QUITE CLOSELY",
  5: "VERY CLOSELY",
};

export function parseTrainerDiscoveryStrictness(raw: string | null | undefined): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 3;
  return Math.min(
    TRAINER_DISCOVERY_STRICTNESS_MAX,
    Math.max(TRAINER_DISCOVERY_STRICTNESS_MIN, Math.round(n)),
  );
}

type Metrics = { nicheHits: number; serviceOk: boolean; deliveryOk: boolean };

/** Higher levels require tighter alignment between client prefs and trainer match text. */
export function clientMatchesTrainerDiscoveryStrictness(
  level: number,
  prefs: ClientMatchPreferences,
  m: Metrics,
): boolean {
  const tokens = clientPreferenceSearchTokens(prefs);
  const hasTokens = tokens.length > 0;

  if (!m.serviceOk) return false;

  if (level <= 1) {
    if (!hasTokens) return true;
    return m.nicheHits >= 1;
  }
  if (level === 2) {
    if (!hasTokens) return true;
    return m.nicheHits >= 1;
  }
  if (level === 3) {
    if (!m.deliveryOk) return false;
    if (!hasTokens) return true;
    return m.nicheHits >= 1;
  }
  if (level === 4) {
    if (!m.deliveryOk) return false;
    if (!hasTokens) return true;
    return m.nicheHits >= 2;
  }
  // level 5 — very closely
  if (!m.deliveryOk) return false;
  if (!hasTokens) return true;
  return m.nicheHits >= 2;
}
