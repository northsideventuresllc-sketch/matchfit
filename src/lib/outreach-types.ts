export type OutreachPlatform = "instagram" | "facebook" | "email" | "other";

export type OutreachTargetGroup = "ATL_LOCAL" | "VIRTUAL";

export type OutreachLeadStatus =
  | "LEAD"
  | "OUTREACH_SENT"
  | "FOLLOW_UP_1"
  | "FOLLOW_UP_2"
  | "RESPONSE_RECEIVED";

export type OutreachAutoClassification =
  | "ACTIVE_LEAD"
  | "FOLLOW_UP_NEEDED"
  | "STATUS_UNKNOWN"
  | "DEAD_LEAD";

export const OUTREACH_PLATFORMS: { id: OutreachPlatform; label: string }[] = [
  { id: "instagram", label: "Instagram" },
  { id: "facebook", label: "Facebook Pages" },
  { id: "email", label: "Trainer Emails" },
  { id: "other", label: "Other" },
];

export const OUTREACH_STATUS_OPTIONS: { id: OutreachLeadStatus; label: string }[] = [
  { id: "LEAD", label: "Lead" },
  { id: "OUTREACH_SENT", label: "Outreach sent" },
  { id: "FOLLOW_UP_1", label: "1× follow-up sent" },
  { id: "FOLLOW_UP_2", label: "2× follow-up sent" },
  { id: "RESPONSE_RECEIVED", label: "Response received" },
];

export const OUTREACH_CLASSIFICATION_LABELS: Record<OutreachAutoClassification, string> = {
  ACTIVE_LEAD: "Active lead",
  FOLLOW_UP_NEEDED: "Follow-up needed",
  STATUS_UNKNOWN: "Status unknown",
  DEAD_LEAD: "Dead lead",
};

export type InstagramLeadRow = {
  id: string;
  handle: string;
  profileUrl: string;
  niche: string;
  targetGroup: string;
  whyMatchFit: string;
  likelihoodScore: number;
  notes: string | null;
  dmText: string;
  commentText: string;
  commentPostRef: string | null;
  genericInviteTail: string | null;
  status: string;
  autoClassification: string;
  outreachSentAt: string | null;
  followUp1SentAt: string | null;
  followUp2SentAt: string | null;
  responseReceivedAt: string | null;
  dmTextEdited: boolean;
  commentTextEdited: boolean;
  generationBatchId: string | null;
  createdAt: string;
  deletedAt: string | null;
};

export type FacebookLeadRow = {
  id: string;
  pageName: string;
  pageUrl: string;
  audience: string;
  niche: string | null;
  targetGroup: string;
  whyMatchFit: string;
  likelihoodScore: number;
  notes: string | null;
  pagePostText: string;
  genericInviteTail: string | null;
  status: string;
  autoClassification: string;
  outreachSentAt: string | null;
  responseReceivedAt: string | null;
  pagePostTextEdited: boolean;
  generationBatchId: string | null;
  createdAt: string;
  deletedAt: string | null;
};

export type EmailLeadRow = {
  id: string;
  name: string;
  email: string;
  businessName: string | null;
  niche: string | null;
  emailSourceUrl: string | null;
  targetGroup: string;
  whyMatchFit: string;
  likelihoodScore: number;
  notes: string | null;
  emailSubject: string;
  emailBody: string;
  genericInviteTail: string | null;
  status: string;
  autoClassification: string;
  outreachSentAt: string | null;
  followUp1SentAt: string | null;
  followUp2SentAt: string | null;
  responseReceivedAt: string | null;
  emailBodyEdited: boolean;
  generationBatchId: string | null;
  createdAt: string;
  deletedAt: string | null;
};

export type OtherLeadRow = {
  id: string;
  contactLabel: string;
  contactUrl: string | null;
  channelNotes: string | null;
  niche: string | null;
  targetGroup: string;
  whyMatchFit: string;
  likelihoodScore: number;
  notes: string | null;
  outreachText: string;
  genericInviteTail: string | null;
  status: string;
  autoClassification: string;
  outreachSentAt: string | null;
  followUp1SentAt: string | null;
  followUp2SentAt: string | null;
  responseReceivedAt: string | null;
  outreachTextEdited: boolean;
  generationBatchId: string | null;
  createdAt: string;
  deletedAt: string | null;
};

export function targetGroupLabel(group: string): string {
  return group === "ATL_LOCAL" ? "ATL local" : "Virtual";
}

export function statusLabelForPlatform(status: string, platform: OutreachPlatform): string {
  if (status === "OUTREACH_SENT") {
    if (platform === "instagram") return "DM sent & comment posted & followed";
    if (platform === "facebook") return "Posted on page";
    if (platform === "email") return "Email sent";
    return "Outreach sent";
  }
  const match = OUTREACH_STATUS_OPTIONS.find((o) => o.id === status);
  return match?.label ?? status;
}
