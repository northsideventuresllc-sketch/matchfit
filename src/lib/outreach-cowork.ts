/**
 * Match Fit Outreach — Cowork autonomy surface (MF-OUT-COWORK).
 * Locked SOP: vault "Match Fit Outreach Cowork SOP" + NI-Brain Decisions 2026-07-13.
 * JB only handles live DM/email send; agents own pipeline fill, brief, and status tooling.
 */

/** Workflow 2 locked: M–F morning pack = 5 IG + 5 email. */
export const OUTREACH_COWORK_DAILY_CAPS = {
  instagram: 5,
  email: 5,
  facebook: 5,
} as const;

/** Required before any live send (Decision: List With Us · Join as FP · Both). */
export const OUTREACH_INTENT_VALUES = ["LIST_WITH_US", "JOIN_AS_FP", "BOTH"] as const;
export type OutreachIntent = (typeof OUTREACH_INTENT_VALUES)[number];

export const OUTREACH_INTENT_OPTIONS: { id: OutreachIntent; label: string }[] = [
  { id: "LIST_WITH_US", label: "List With Us" },
  /** Internal enum stays JOIN_AS_FP; operator-facing label is Fitness Pro (canonical label — CLAUDE.md Product Copy). */
  { id: "JOIN_AS_FP", label: "Join as Fitness Pro" },
  { id: "BOTH", label: "Both" },
];

export function isOutreachIntent(value: unknown): value is OutreachIntent {
  return (
    typeof value === "string" &&
    (OUTREACH_INTENT_VALUES as readonly string[]).includes(value)
  );
}

export function outreachIntentLabel(intent: string | null | undefined): string {
  if (!intent) return "Unset";
  const match = OUTREACH_INTENT_OPTIONS.find((o) => o.id === intent);
  return match?.label ?? intent;
}

/** Statuses that mean a live send happened or is claimed. */
const SEND_CLAIM_STATUSES = new Set([
  "OUTREACH_SENT",
  "FOLLOW_UP_1",
  "FOLLOW_UP_2",
]);

export function outreachSendRequiresIntent(
  platform: "instagram" | "facebook" | "email",
  nextStatus: string | undefined,
): boolean {
  if (platform === "facebook") return false;
  if (!nextStatus) return false;
  return SEND_CLAIM_STATUSES.has(nextStatus);
}

/** Read-only Instagram send checklist shown on the Outreach HQ v2 lead card (mirrors the checklist below). */
export const OUTREACH_INSTAGRAM_PROCEDURE_STEPS = [
  "Confirm this is the correct person or account.",
  "Send the DM.",
  "Follow the account.",
  "Like the 4 most recent posts.",
  "Comment on the referenced post.",
] as const;

export const OUTREACH_COWORK_EMAIL_FROM = "jb@match-fit.net";
/** Workflow 2 locked BCC trio — always include all three. */
export const OUTREACH_COWORK_EMAIL_BCC = [
  "jb@northsideintelligence.com",
  "support@match-fit.net",
  "jb@northsideventuresgroup.com",
] as const;

/** Paste-ready runner prompt for Claude Cowork (JB or agent). */
export function buildCoworkRunnerPrompt(generatedAtIso: string): string {
  const { instagram, email } = OUTREACH_COWORK_DAILY_CAPS;
  return [
    "Match Fit Outreach — Cowork morning runner",
    `Generated: ${generatedAtIso}`,
    "",
    "Rules (locked):",
    "- Every lead must have outreach intent before send: List With Us · Join as Fitness Pro · Both.",
    "- Unclear intent = do not send.",
    "- REV-FIRST priority: send Join as Fitness Pro / Both ready hub leads first.",
    "- Outbound copy: Fitness Pros (not Coaches); CTA match-fit.net/trainer/sign-up; founding promo = first 30×60d Premium + first 10 fee waiver (vary wording).",
    `- Daily caps: ${instagram} Instagram + ${email} email.`,
    "- JB only for live DM/email send. Agent owns generate, hub save, copy, status updates.",
    "",
    "Instagram checklist per lead:",
    "1) Open profileUrl",
    "2) Send dmText",
    "3) Follow",
    "4) Like 4 recent posts",
    "5) Comment commentText on commentPostRef",
    "6) Set status to Outreach sent (PATCH /api/admin/outreach/leads/[id])",
    "",
    "Email checklist per lead:",
    `1) From ${OUTREACH_COWORK_EMAIL_FROM}`,
    `2) BCC ${OUTREACH_COWORK_EMAIL_BCC.join(" + ")}`,
    "3) Send emailSubject / emailBody",
    "4) PATCH status to Outreach sent",
    "",
    "Pull today's brief: GET /api/admin/outreach/cowork-brief",
    "Work only leads returned in the brief. Skip any missing intent until set in Outreach Hub.",
  ].join("\n");
}

export function buildCoworkBriefInstructions(): string {
  const { instagram, email } = OUTREACH_COWORK_DAILY_CAPS;
  return [
    "Claude Cowork morning workflow (Match Fit Outreach):",
    "1. GET /api/admin/outreach/cowork-brief (or open /admin/outreach → Cowork Brief).",
    "2. For each Instagram lead: set intent if unset → DM → follow → like 4 → comment → PATCH status OUTREACH_SENT.",
    "3. For each email lead: set intent if unset → send from jb@match-fit.net with required BCC → PATCH status OUTREACH_SENT.",
    "4. Facebook (optional): post pagePostText on pageUrl when listed.",
    "5. Edit copy in Outreach Hub before sending if needed — edits train the next generation.",
    `6. Never send without intent. Never exceed daily caps (${instagram} IG / ${email} email).`,
  ].join("\n");
}
