export type AdminAiAction =
  | "set_goal"
  | "goal_analysis"
  | "site_analysis"
  | "signup_recommendations"
  | "freeform";

export const ADMIN_AI_ACTION_LABELS: Record<AdminAiAction, string> = {
  set_goal: "Set a goal",
  goal_analysis: "Review my goals",
  site_analysis: "Analyze site traffic",
  signup_recommendations: "Grow sign-ups",
  freeform: "Ask a question",
};

export const ADMIN_AI_QUICK_PROMPTS: Array<{
  action: AdminAiAction;
  label: string;
  description: string;
}> = [
  {
    action: "signup_recommendations",
    label: "Grow sign-ups",
    description: "Get practical ideas to turn more visitors into clients and trainers.",
  },
  {
    action: "site_analysis",
    label: "Traffic insights",
    description: "See where people land, what they click, and where the funnel leaks.",
  },
  {
    action: "goal_analysis",
    label: "Goal check-in",
    description: "Compare your active goals against live platform and traffic numbers.",
  },
  {
    action: "set_goal",
    label: "Set a KPI goal",
    description: "Capture a measurable target for subscribers, sign-ups, or revenue.",
  },
];

/** Strip legacy technical dumps that should never appear in the operator UI. */
export function sanitizeAssistantMessageForDisplay(content: string): string {
  const trimmed = content.trim();
  if (!trimmed) return trimmed;

  const snapshotIdx = trimmed.indexOf("Context snapshot:");
  if (snapshotIdx !== -1) {
    return "The AI assistant is temporarily offline. Try again in a moment, or use one of the quick prompts above for built-in insights.";
  }

  if (trimmed.includes("OPENAI_API_KEY") || trimmed.includes("via the API")) {
    return "The AI assistant is not fully configured yet. You can still use quick prompts for traffic and sign-up recommendations.";
  }

  return trimmed;
}

export function formatUserMessageForDisplay(content: string, actionType: string | null): string {
  if (actionType && actionType in ADMIN_AI_ACTION_LABELS) {
    const label = ADMIN_AI_ACTION_LABELS[actionType as AdminAiAction];
    const normalized = content.trim().toLowerCase();
    const actionSlug = actionType.replace(/_/g, " ");
    if (!content.trim() || normalized === actionSlug || normalized === label.toLowerCase()) {
      return label;
    }
  }
  return content.trim();
}

export function formatConversationTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatMessageTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export const NEW_CONVERSATION_TITLE = "NEW CONVERSATION";

/** Display default conversation titles in all caps for the operator UI. */
export function formatConversationTitleForDisplay(title: string | null | undefined): string {
  const trimmed = (title ?? "").trim();
  if (!trimmed || trimmed.toLowerCase() === "new conversation" || trimmed.toLowerCase() === "start a conversation") {
    return NEW_CONVERSATION_TITLE;
  }
  return trimmed;
}

export type AssistantStatsSnapshotInput = {
  allMembersTotal: number;
  subscribedClients: number;
  compliantActiveTrainers: number;
  pendingTrainers: number;
  freeTrialClients: number;
  uniqueVisitors7d: number;
};

/** Matches dashboard member overview semantics — not live online users. */
export function formatAssistantStatsSnapshot(input: AssistantStatsSnapshotInput): {
  line: string;
  hint: string;
} {
  return {
    line: `${input.allMembersTotal} all members total · ${input.subscribedClients} subscribed clients · ${input.compliantActiveTrainers} active trainers · ${input.pendingTrainers} pending trainers · ${input.freeTrialClients} free trials · ${input.uniqueVisitors7d} visitors (7d)`,
    hint: "All members total = real clients + trainers with Terms accepted (excludes test/QA and deleted accounts).",
  };
}
