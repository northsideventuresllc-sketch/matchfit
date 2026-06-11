export type OutreachPlatform = "instagram" | "facebook" | "email";

export type OutreachTargetGroup = "ATL_LOCAL" | "VIRTUAL";

/** Instagram + email pipeline statuses */
export type OutreachLeadStatus =
  | "LEAD"
  | "OUTREACH_SENT"
  | "FOLLOW_UP_1"
  | "FOLLOW_UP_2"
  | "RESPONSE_RECEIVED"
  | "DEAD_LEAD";

/** Facebook group/page outreach pipeline */
export type FacebookLeadStatus =
  | "LEAD"
  | "GROUP_JOIN_REQUESTED"
  | "GROUP_JOINED"
  | "POST_SUBMITTED_PENDING_REVIEW"
  | "POST_APPROVED"
  | "RESPONSE_RECEIVED"
  | "DEAD_LEAD";

export type OutreachAutoClassification =
  | "ACTIVE_LEAD"
  | "FOLLOW_UP_NEEDED"
  | "STATUS_UNKNOWN"
  | "DEAD_LEAD";

export const OUTREACH_PLATFORMS: { id: OutreachPlatform; label: string }[] = [
  { id: "instagram", label: "Instagram" },
  { id: "facebook", label: "Facebook Pages" },
  { id: "email", label: "Trainer Emails" },
];

export const OUTREACH_STATUS_OPTIONS: { id: OutreachLeadStatus; label: string }[] = [
  { id: "LEAD", label: "Lead" },
  { id: "OUTREACH_SENT", label: "Outreach sent" },
  { id: "FOLLOW_UP_1", label: "1× follow-up sent" },
  { id: "FOLLOW_UP_2", label: "2× follow-up sent" },
  { id: "RESPONSE_RECEIVED", label: "Response received" },
  { id: "DEAD_LEAD", label: "Dead Lead" },
];

export const FACEBOOK_OUTREACH_STATUS_OPTIONS: { id: FacebookLeadStatus; label: string }[] = [
  { id: "LEAD", label: "Lead" },
  { id: "GROUP_JOIN_REQUESTED", label: "Group Join Requested" },
  { id: "GROUP_JOINED", label: "Group Joined" },
  { id: "POST_SUBMITTED_PENDING_REVIEW", label: "Post Submitted/Pending Review" },
  { id: "POST_APPROVED", label: "Post Approved" },
  { id: "RESPONSE_RECEIVED", label: "Response Received" },
  { id: "DEAD_LEAD", label: "Dead Lead" },
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
  savedToHubAt: string | null;
  deadLeadAt: string | null;
  archivedAt: string | null;
  archivePurgeAfterAt: string | null;
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
  savedToHubAt: string | null;
  deadLeadAt: string | null;
  archivedAt: string | null;
  archivePurgeAfterAt: string | null;
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
  savedToHubAt: string | null;
  deadLeadAt: string | null;
  archivedAt: string | null;
  archivePurgeAfterAt: string | null;
};

export type OutreachLeadProfileSnapshot = {
  platform: OutreachPlatform;
  niche?: string | null;
  targetGroup?: string;
  whyMatchFit?: string;
  likelihoodScore?: number;
  handle?: string;
  pageName?: string;
  name?: string;
  email?: string;
  status?: string;
};

export type OutreachArchiveLead = {
  platform: OutreachPlatform;
  archivedAt: string | null;
  deadLeadAt: string | null;
  archivePurgeAfterAt: string | null;
  lead: InstagramLeadRow | FacebookLeadRow | EmailLeadRow;
};

export type OutreachHubLead = {
  platform: OutreachPlatform;
  savedToHubAt: string;
  lead: InstagramLeadRow | FacebookLeadRow | EmailLeadRow;
};

export function targetGroupLabel(group: string): string {
  return group === "ATL_LOCAL" ? "ATL local" : "Virtual";
}

export function outreachStatusOptionsForPlatform(
  platform: OutreachPlatform,
): { id: string; label: string }[] {
  if (platform === "facebook") return FACEBOOK_OUTREACH_STATUS_OPTIONS;
  return OUTREACH_STATUS_OPTIONS;
}

const FACEBOOK_STATUS_LABELS: Record<string, string> = Object.fromEntries(
  FACEBOOK_OUTREACH_STATUS_OPTIONS.map((o) => [o.id, o.label]),
);

export function statusLabelForPlatform(status: string, platform: OutreachPlatform): string {
  if (platform === "facebook") {
    return FACEBOOK_STATUS_LABELS[status] ?? status.replaceAll("_", " ").toLowerCase();
  }
  if (status === "OUTREACH_SENT") {
    if (platform === "instagram") return "DM sent & comment posted & followed";
    if (platform === "email") return "Email sent";
    return "Outreach sent";
  }
  const match = OUTREACH_STATUS_OPTIONS.find((o) => o.id === status);
  return match?.label ?? status;
}

export const OUTREACH_PLATFORM_VALUES = ["instagram", "facebook", "email"] as const;

export const INSTAGRAM_EMAIL_STATUS_VALUES = [
  "LEAD",
  "OUTREACH_SENT",
  "FOLLOW_UP_1",
  "FOLLOW_UP_2",
  "RESPONSE_RECEIVED",
  "DEAD_LEAD",
] as const;

export const FACEBOOK_STATUS_VALUES = [
  "LEAD",
  "GROUP_JOIN_REQUESTED",
  "GROUP_JOINED",
  "POST_SUBMITTED_PENDING_REVIEW",
  "POST_APPROVED",
  "RESPONSE_RECEIVED",
  "DEAD_LEAD",
] as const;

/** Hours after dead-lead label before a lead moves to archive. */
export const OUTREACH_DEAD_LEAD_ARCHIVE_HOURS = 48;

/** Days archived leads are kept per admin account before purge. */
export const OUTREACH_ARCHIVE_RETENTION_DAYS = 60;
