/**
 * Match Fit B2C (client acquisition) operator runbook.
 * Phases 5b–6b map to marketing playbook steps 5–6 with a client-only checklist.
 */

import { MATCH_FIT_DEFAULT_ADS_SURFACE_PATH } from "@/lib/match-fit-ads-surface";
import type { MatchFitMarketingPlaybookStepId } from "@/lib/match-fit-marketing-playbook";

export type MatchFitB2cRunbookPhaseId = "5b_confirm_client_tags" | "6b_build_client_links";

export type MatchFitB2cRunbookPhase = {
  phase: string;
  id: MatchFitB2cRunbookPhaseId;
  title: string;
  description: string;
  playbookStep: number;
  playbookStepId: MatchFitMarketingPlaybookStepId;
  adminPath: string;
  checklist: string[];
};

export const MATCH_FIT_B2C_RUNBOOK_PHASE_5B: MatchFitB2cRunbookPhase = {
  phase: "5b",
  id: "5b_confirm_client_tags",
  title: "Confirm client tags",
  description:
    "Before you spend on client ads, confirm Meta and Google tags are live and the client signup conversion is wired.",
  playbookStep: 5,
  playbookStepId: "confirm_tags",
  adminPath: MATCH_FIT_DEFAULT_ADS_SURFACE_PATH,
  checklist: [
    "Meta pixel ID in Events Manager matches Connected Pixels below",
    "Google Ads tag ID matches Connected Pixels below",
    "Client signup conversion shows Connected (Google Ads)",
    "Meta standard event Subscribe fires on client paid signup (see Conversion Events catalog)",
    "Optional but recommended: Meta CAPI and GA4 Measurement Protocol show connected",
  ],
};

export const MATCH_FIT_B2C_RUNBOOK_PHASE_6B: MatchFitB2cRunbookPhase = {
  phase: "6b",
  id: "6b_build_client_links",
  title: "Build client tracking links",
  description:
    "Every client ad must land on a tagged URL — use the client sign-up path when slots are open, or waitlist when the cap is full.",
  playbookStep: 6,
  playbookStepId: "build_links",
  adminPath: MATCH_FIT_DEFAULT_ADS_SURFACE_PATH,
  checklist: [
    "Landing page is Client sign-up (/client/sign-up) or waitlist if beta cap is full",
    "Apply the Meta — client beta preset (or match utm_campaign client_beta_launch)",
    "Copy the final URL before you paste into Meta, Google, or TikTok",
    "Never send paid traffic to the homepage without UTMs",
  ],
};

export const MATCH_FIT_B2C_RUNBOOK_PHASES_5B_6B: MatchFitB2cRunbookPhase[] = [
  MATCH_FIT_B2C_RUNBOOK_PHASE_5B,
  MATCH_FIT_B2C_RUNBOOK_PHASE_6B,
];

export type B2cRunbook5bReadinessInput = {
  clientSignupConversionConfigured: boolean;
  trainerSignupConversionConfigured: boolean;
  metaCapiConfigured: boolean;
  ga4Configured: boolean;
};

export type B2cRunbookChecklistItem = {
  label: string;
  ok: boolean | null;
};

export function b2cRunbook5bChecklist(input: B2cRunbook5bReadinessInput): B2cRunbookChecklistItem[] {
  return [
    { label: "Meta pixel ID visible in Connected Pixels", ok: true },
    { label: "Google tag ID visible in Connected Pixels", ok: true },
    {
      label: "Client signup conversion configured (Google Ads)",
      ok: input.clientSignupConversionConfigured,
    },
    {
      label: "Meta CAPI connected (recommended)",
      ok: input.metaCapiConfigured ? true : false,
    },
    {
      label: "GA4 Measurement Protocol connected (recommended)",
      ok: input.ga4Configured ? true : false,
    },
  ];
}

export function b2cRunbook5bReady(input: B2cRunbook5bReadinessInput): boolean {
  return input.clientSignupConversionConfigured;
}

export function b2cRunbookPhaseLabel(phase: string): string {
  const row = MATCH_FIT_B2C_RUNBOOK_PHASES_5B_6B.find((p) => p.phase === phase);
  return row ? `Runbook ${row.phase} — ${row.title}` : `Runbook ${phase}`;
}
