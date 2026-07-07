/** Canonical Match Fit weekly marketing playbook — 8 steps from plan to paid review. */

export type MatchFitMarketingPlaybookStepId =
  | "plan_week"
  | "generate_content"
  | "publish_organic"
  | "outreach_dms"
  | "confirm_tags"
  | "build_links"
  | "launch_paid"
  | "register_and_review";

export type MatchFitMarketingPlaybookStep = {
  step: number;
  id: MatchFitMarketingPlaybookStepId;
  title: string;
  description: string;
  /** Admin route when the step runs in-app; omit for JB-lane steps. */
  adminPath?: string;
  /** Owner executes outside the admin portal (social post, ad platform UI). */
  jbLane?: boolean;
};

export const MATCH_FIT_MARKETING_PLAYBOOK_STEPS: MatchFitMarketingPlaybookStep[] = [
  {
    step: 1,
    id: "plan_week",
    title: "Plan the week",
    description:
      "Pick audience (client vs Fitness Pro), content pillar, and paid budget. Align promos with /promos before you spend.",
    adminPath: "/admin/ad-tracking",
  },
  {
    step: 2,
    id: "generate_content",
    title: "Generate content",
    description: "Draft posts, reels, and captions in Content Calendar — match the calendar pillar for the day.",
    adminPath: "/admin/content-calendar",
  },
  {
    step: 3,
    id: "publish_organic",
    title: "Publish organic",
    description: "Post to Instagram, Threads, TikTok, and Facebook using Content Hub copy.",
    jbLane: true,
  },
  {
    step: 4,
    id: "outreach_dms",
    title: "Outreach DMs",
    description: "Send 10–15 targeted DMs from Outreach HQ — follow up on warm leads the same week.",
    adminPath: "/admin/outreach",
  },
  {
    step: 5,
    id: "confirm_tags",
    title: "Confirm tags",
    description: "Verify Meta and Google pixel IDs in Events Manager and Google Ads match Ad Tracking HQ.",
    adminPath: "/admin/ad-tracking",
  },
  {
    step: 6,
    id: "build_links",
    title: "Build tracking links",
    description: "Generate UTM URLs for each ad creative — never send traffic to the homepage without tags.",
    adminPath: "/admin/ad-tracking",
  },
  {
    step: 7,
    id: "launch_paid",
    title: "Launch paid campaign",
    description:
      "Create conversion goals in Meta and Google using Match Fit event names, then go live in Ads Manager or TikTok Promote.",
    jbLane: true,
  },
  {
    step: 8,
    id: "register_and_review",
    title: "Register campaign and review",
    description:
      "Record the platform campaign ID with week and budget, sync performance, and compare ad spend to on-site attribution.",
    adminPath: "/admin/ad-tracking",
  },
];

export function matchFitMarketingPlaybookStep(stepNumber: number): MatchFitMarketingPlaybookStep | undefined {
  return MATCH_FIT_MARKETING_PLAYBOOK_STEPS.find((s) => s.step === stepNumber);
}

export function matchFitMarketingPlaybookStepById(
  id: MatchFitMarketingPlaybookStepId,
): MatchFitMarketingPlaybookStep {
  const row = MATCH_FIT_MARKETING_PLAYBOOK_STEPS.find((s) => s.id === id);
  if (!row) throw new Error(`Unknown marketing playbook step: ${id}`);
  return row;
}

export function matchFitMarketingPlaybookLabel(stepNumber: number): string {
  const row = matchFitMarketingPlaybookStep(stepNumber);
  return row ? `Step ${row.step} — ${row.title}` : `Step ${stepNumber}`;
}
