/**
 * Match Fit transactional email palette — aligned with `public/logo.png`
 * (navy wordmark, red “Fit”, warm orange / olive in the mark).
 */
export const MF_EMAIL_BRAND = {
  navy: "#333F48",
  navyDeep: "#1c2430",
  navyHeader: "#252f38",
  red: "#E63946",
  redDark: "#c62f3a",
  orange: "#F4A261",
  orangeMid: "#F2994A",
  olive: "#606C38",
  cream: "#FDF8F3",
  mutedOnDark: "#b8c0c8",
  borderDark: "#2a3540",
} as const;

export function matchFitEmailLogoUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, "")}/logo.png`;
}

/**
 * Homepage / app UI — dark canvas, gold → orange → red accents (`src/app/page.tsx`, auth shells).
 * Use for transactional HTML that should match the live product.
 */
export const MF_EMAIL_SITE = {
  bg: "#0B0C0F",
  panel: "#0E1016",
  gold: "#FFD34E",
  orange: "#FF7E00",
  red: "#E32B2B",
  textPrimary: "#F4F6FA",
  textMatch: "#E8EAEF",
  textMuted: "#9CA3AF",
  border: "#262a33",
  /** Dark burnt-orange into site canvas */
  outerBgGradient:
    "linear-gradient(180deg,#5c3014 0%,#3d1f0c 22%,#241308 48%,#120a05 72%,#0B0C0F 100%)",
  ctaText: "#0B0C0F",
} as const;
